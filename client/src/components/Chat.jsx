import React, { useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { initializeSocket } from "../utils/socket";
import { useSelector } from "react-redux";
import axios from "axios";
import { BASE_URL } from "../utils/constants";

const ChatWindow = ({ targetUserId }) => {
  const user = useSelector((store) => store.user);
  const userId = user?._id;
  const socketRef = useRef(null);
  const messagesRef = useRef([]);
  const typingTimer = useRef(null);
  const bottomRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!userId || !targetUserId) return;
    let active = true;
    let remoteTypingTimer;
    let reading = false;
    let readAgain = false;
    const socket = initializeSocket();
    socketRef.current = socket;

    const updateMessages = (incoming) => {
      const saved = new Map(messagesRef.current.map((message) => [String(message._id), message]));
      incoming.forEach((message) => saved.set(String(message._id), message));
      messagesRef.current = Array.from(saved.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(messagesRef.current);
    };

    const markMessagesRead = async () => {
      if (!active || document.visibilityState !== "visible" || !document.hasFocus()) return;
      if (reading) {
        readAgain = true;
        return;
      }
      const messageIds = messagesRef.current.filter((message) => String(message.senderId) !== String(userId) && !message.readAt).map((message) => message._id).slice(0, 5000);
      if (!messageIds.length) return;
      reading = true;
      try {
        const res = await axios.patch(BASE_URL + "/chat/" + targetUserId + "/read", { messageIds }, { withCredentials: true });
        if (!active) return;
        const readIds = new Set(messageIds.map(String));
        updateMessages(messagesRef.current.map((message) => readIds.has(String(message._id)) ? { ...message, readAt: res.data.readAt } : message));
        window.dispatchEvent(new Event("notificationsUpdated"));
        window.dispatchEvent(new Event("chatUpdated"));
        readAgain = true;
      } catch {
        if (active) setError("Unable to mark messages as read. Please try again.");
      } finally {
        reading = false;
        if (readAgain) {
          readAgain = false;
          markMessagesRead();
        }
      }
    };

    const fetchMessages = async () => {
      try {
        const chat = await axios.get(BASE_URL + "/chat/" + targetUserId, { withCredentials: true });
        if (!active) return;
        updateMessages(chat.data.messages.map((msg) => ({
          _id: msg._id,
          firstName: msg.senderId?.firstName || "",
          text: msg.text,
          senderId: String(msg.senderId?._id || msg.senderId || ""),
          createdAt: msg.createdAt,
          readAt: msg.readAt,
        })));
        setError("");
        setLimitReached(false);
        markMessagesRead();
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Unable to load chat.");
      }
    };

    socket.on("connect", () => {
      socket.timeout(10000).emit("joinChat", { targetUserId }, (err, response) => {
        if (!active) return;
        if (err || !response?.success) setError("Unable to join this chat. Please try again.");
        else fetchMessages();
      });
    });
    socket.on("receiveMessage", (message) => {
      if (!active) return;
      updateMessages([message]);
      setTyping(false);
      markMessagesRead();
    });
    socket.on("typing", ({ senderId, isTyping }) => {
      if (String(senderId) !== String(targetUserId)) return;
      clearTimeout(remoteTypingTimer);
      setTyping(isTyping);
      if (isTyping) remoteTypingTimer = setTimeout(() => setTyping(false), 3000);
    });
    socket.on("errorMessage", (error) => {
      setError(error.message);
      setLimitReached(error.code === "DAILY_LIMIT");
    });
    socket.on("connect_error", (error) => setError(error.message));
    window.addEventListener("focus", markMessagesRead);
    document.addEventListener("visibilitychange", markMessagesRead);
    // Recover missed messages after reconnects and while a chat stays open.
    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") fetchMessages();
    }, 30000);

    return () => {
      active = false;
      clearInterval(refresh);
      clearTimeout(remoteTypingTimer);
      clearTimeout(typingTimer.current);
      if (socket.connected) socket.emit("typing", { targetUserId, isTyping: false });
      socket.disconnect();
      socketRef.current = null;
      window.removeEventListener("focus", markMessagesRead);
      document.removeEventListener("visibilitychange", markMessagesRead);
    };
  }, [userId, targetUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, typing]);

  const stopTyping = () => {
    clearTimeout(typingTimer.current);
    if (socketRef.current?.connected) socketRef.current.emit("typing", { targetUserId, isTyping: false });
  };

  const handleMessageChange = (value) => {
    setNewMessage(value);
    clearTimeout(typingTimer.current);
    if (socketRef.current?.connected) socketRef.current.emit("typing", { targetUserId, isTyping: Boolean(value.trim()) });
    typingTimer.current = setTimeout(stopTyping, 1500);
  };

  const sendMessage = () => {
    if (!newMessage.trim() || sending) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError("Chat is reconnecting. Please try again shortly.");
      return;
    }
    stopTyping();
    setSending(true);
    setError("");
    socket.timeout(10000).emit("sendMessage", { text: newMessage, targetUserId }, (err, response) => {
      setSending(false);
      if (err) setError("Message confirmation timed out. Check the chat before sending again.");
      else if (response?.success) setNewMessage("");
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto border border-gray-600 my-5 h-[70vh] flex flex-col">
      <h1 className="p-5 border-b border-gray-600">Chat</h1>
      {error && (
        <div className="alert alert-error rounded-none" role="alert">
          <span>{error}</span>
          {limitReached && <Link to="/premium" className="link">Upgrade to premium</Link>}
        </div>
      )}
      <div className="flex-1 overflow-auto p-5">
        {messages.map((msg) => (
          <div key={msg._id} className={`chat ${String(userId) === String(msg.senderId) ? "chat-end" : "chat-start"}`}>
            <div className="chat-header">
              {msg.firstName}
              <time className="text-xs opacity-50">
                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
              </time>
            </div>
            <div className="chat-bubble">{msg.text}</div>
          </div>
        ))}
        <div className="text-sm text-base-content/50 h-6" role="status" aria-live="polite">
          {typing && "Typing..."}
        </div>
        <div ref={bottomRef}></div>
      </div>
      <div className="p-5 border-t border-gray-600 flex items-center gap-2">
        <input
          disabled={sending}
          maxLength={2000}
          aria-label="Message"
          placeholder="Write a message..."
          className="input input-bordered flex-1 min-w-0"
          value={newMessage}
          onChange={(e) => handleMessageChange(e.target.value)}
          onBlur={stopTyping}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button disabled={sending || !newMessage.trim()} onClick={sendMessage} className="btn btn-secondary">
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
};

const Chat = () => {
  const { targetUserId } = useParams();
  return <ChatWindow key={targetUserId} targetUserId={targetUserId} />;
};

export default Chat;
