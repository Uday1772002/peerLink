import React, { useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { initializeSocket } from "../utils/socket";
import { useSelector } from "react-redux";
import axios from "axios";
import { BASE_URL } from "../utils/constants";

const Chat = () => {
  const { targetUserId } = useParams();
  const user = useSelector((store) => store.user);
  const userId = user?._id;
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!userId || !targetUserId) return;
    let active = true;
    const fetchMessages = async () => {
      try {
        const chat = await axios.get(BASE_URL + "/chat/" + targetUserId, { withCredentials: true });
        if (!active) return;
        setMessages(chat.data.messages.map((msg) => ({
          firstName: msg.senderId?.firstName || "",
          text: msg.text,
          senderId: String(msg.senderId?._id || msg.senderId || ""),
          createdAt: msg.createdAt,
        })));
        setError("");
        setLimitReached(false);
        const socket = initializeSocket();
        socketRef.current = socket;
        socket.on("connect", () => socket.emit("joinChat", { targetUserId }));
        socket.on("receiveMessage", (message) => {
          setMessages((messages) => [...messages, message]);
        });
        socket.on("errorMessage", (error) => {
          setError(error.message);
          setLimitReached(error.code === "DAILY_LIMIT");
        });
        socket.on("connect_error", (error) => setError(error.message));
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Unable to load chat.");
      }
    };
    fetchMessages();
    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [userId, targetUserId]);

  const sendMessage = () => {
    if (!newMessage.trim() || sending) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError("Chat is reconnecting. Please try again shortly.");
      return;
    }
    setSending(true);
    setError("");
    socket.timeout(10000).emit("sendMessage", { text: newMessage, targetUserId }, (err, response) => {
      setSending(false);
      if (err) {
        setError("Message confirmation timed out. Check the chat before sending again.");
      } else if (response.success) {
        setNewMessage("");
      }
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
        {messages.map((msg, index) => (
          <div key={index} className={`chat ${String(userId) === String(msg.senderId) ? "chat-end" : "chat-start"}`}>
            <div className="chat-header">
              {msg.firstName}
              <time className="text-xs opacity-50">
                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
              </time>
            </div>
            <div className="chat-bubble">{msg.text}</div>
          </div>
        ))}
      </div>
      <div className="p-5 border-t border-gray-600 flex items-center gap-2">
        <input
          disabled={sending}
          maxLength={2000}
          aria-label="Message"
          placeholder="Write a message..."
          className="input input-bordered flex-1 min-w-0"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          disabled={sending || !newMessage.trim()}
          onClick={sendMessage}
          className="btn btn-secondary"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
};

export default Chat;
