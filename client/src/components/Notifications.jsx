import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/constants";
import { initializeSocket } from "../utils/socket";

const Notifications = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const fetchNotifications = async () => {
      const currentRevision = ++revision;
      try {
        const [notifications, chats] = await Promise.all([
          axios.get(BASE_URL + "/notifications", { withCredentials: true }),
          axios.get(BASE_URL + "/chat/unread", { withCredentials: true }),
        ]);
        if (!active || currentRevision !== revision) return;
        setNotifications(notifications.data.data);
        setUnreadCount(notifications.data.unreadCount);
        setMessageCount(chats.data.unreadCount);
        setError("");
      } catch {
        if (active) setError("Unable to refresh notifications.");
      }
    };
    const socket = initializeSocket();
    socket.on("connect", fetchNotifications);
    socket.on("notification", fetchNotifications);
    socket.on("notificationUpdated", fetchNotifications);
    socket.on("chatUpdated", () => {
      fetchNotifications();
      window.dispatchEvent(new Event("chatUpdated"));
    });
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    window.addEventListener("notificationsUpdated", fetchNotifications);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const interval = setInterval(refreshWhenVisible, 30000);
    fetchNotifications();
    return () => {
      active = false;
      clearInterval(interval);
      socket.disconnect();
      window.removeEventListener("notificationsUpdated", fetchNotifications);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [userId]);

  const markAsRead = async (notificationIds) => {
    if (!notificationIds.length) return true;
    setMarking(true);
    try {
      await axios.patch(BASE_URL + "/notifications/read", { notificationIds }, { withCredentials: true });
      window.dispatchEvent(new Event("notificationsUpdated"));
      return true;
    } catch {
      setError("Unable to mark notifications as read. Please try again.");
      return false;
    } finally {
      setMarking(false);
    }
  };

  const getLink = (notification) => {
    if (notification.type === "request") return "/requests";
    if (notification.type === "connection") return "/connections";
    return "/chat/" + notification.fromUserId;
  };

  return (
    <div className="relative flex items-center gap-2">
      <Link to="/connections" className="btn btn-ghost btn-sm" aria-label={messageCount + " unread messages"}>
        💬 {messageCount > 0 && <span className="badge badge-primary badge-sm">{messageCount}</span>}
      </Link>
      <button
        className="btn btn-ghost btn-sm"
        aria-label={unreadCount + " unread notifications"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        🔔 {unreadCount > 0 && <span className="badge badge-secondary badge-sm">{unreadCount}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[90vw] bg-base-100 rounded-box shadow-xl border border-base-content/10">
          <div className="flex items-center justify-between p-4 border-b border-base-content/10">
            <h2 className="font-semibold">Notifications</h2>
            <button className="btn btn-ghost btn-xs" aria-label="Close notifications" onClick={() => setOpen(false)}>✕</button>
          </div>
          {error && <p className="text-error text-sm p-3" role="alert">{error}</p>}
          <div className="max-h-80 overflow-auto">
            {notifications.length === 0 && !error && <p className="p-5 text-sm text-base-content/50">No notifications yet.</p>}
            {notifications.map((notification) => (
              <Link
                key={notification._id}
                to={getLink(notification)}
                className={"block p-4 border-b border-base-content/10 hover:bg-base-200 " + (!notification.readAt ? "bg-primary/10" : "")}
                onClick={() => {
                  setOpen(false);
                  markAsRead(notification.readAt ? [] : [notification._id]);
                }}
              >
                <p className="text-sm">{!notification.readAt && "● "}{notification.text}</p>
                <time className="text-xs text-base-content/50">{new Date(notification.createdAt).toLocaleString()}</time>
              </Link>
            ))}
          </div>
          {notifications.some((notification) => !notification.readAt) && (
            <button
              className="btn btn-ghost btn-sm w-full"
              disabled={marking}
              onClick={() => markAsRead(notifications.filter((notification) => !notification.readAt).map((notification) => notification._id))}
            >
              Mark shown notifications as read
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
