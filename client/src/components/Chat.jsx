import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { initializeSocket } from "../utils/socket";
import { useSelector } from "react-redux";
import axios from "axios";
import { BASE_URL } from "../utils/constants";

const Chat = () => {
  const { targetUserId } = useParams();

  console.log("Chat: render", { targetUserId });

  const user = useSelector((store) => store.user);
  const userId = user?._id;
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [limitReached, setLimitReached] = useState(false);

  const fetchMessages = async () => {
    const chat = await axios.get(BASE_URL + "/chat/" + targetUserId, {
      withCredentials: true,
    });
    const chatMessages = chat?.data?.messages.map((msg) => {
      return {
        firstName: msg?.senderId?.firstName || "",
        text: msg.text,
        senderId: String(msg?.senderId?._id || msg?.senderId || ""),
      };
    });
    setMessages(chatMessages || []);
  };

  useEffect(() => {
    if (!targetUserId) return;
    fetchMessages();
  }, [targetUserId]);
  //as soon as page loads, we want to join the chat room for this user and target user
  useEffect(() => {
    if (!userId || !targetUserId) return;

    socketRef.current = initializeSocket();
    const socket = socketRef.current;
    //join the chat room for this user and target user
    socket.emit("joinChat", {
      firstName: user.firstName,
      userId,
      targetUserId,
    });
    socket.on("receiveMessage", ({ firstName, text, senderId }) => {
      setMessages((messages) => [
        ...messages,
        { firstName, text, senderId: senderId ? String(senderId) : "" },
      ]);
    });
    socket.on("errorMessage", (message) => {
      alert(message);
      setLimitReached(true);
    });

    //disconnect from the socket when the component unmounts
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, targetUserId]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const socket = socketRef.current;
    if (!socket) return;

    //emit the message to the server
    socket.emit("sendMessage", {
      firstName: user.firstName,
      text: newMessage,
      userId,
      targetUserId,
    });
    setNewMessage("");
  };
  return (
    <div className="w-3/4 mx-auto border border-gray-600 m-5 h-[70vh] flex flex-col">
      <h1 className="p-5 border-b border-gray-600">Chat</h1>
      <div className="flex-1 overflow-auto p-5">
        {messages.map((msg, index) => {
          return (
            <div
              key={index}
              className={`chat ${String(userId) === String(msg.senderId) ? "chat-end" : "chat-start"}`}
            >
              <div className="chat-header">
                {`${msg.firstName}`}
                <time className="text-xs opacity-50">
                  {new Date().toLocaleTimeString()}
                </time>
              </div>
              <div className="chat-bubble">{msg.text}</div>
              <div className="chat-footer opacity-50">Seen</div>
            </div>
          );
        })}
      </div>
      <div className="p-5 border-t border-gray-600 flex items-center gap-2">
        <input
          disabled={limitReached}
          className="flex-1 border border-gray-500 text-white rounded p-2"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button
          disabled={limitReached}
          onClick={sendMessage}
          className="btn btn-secondary"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;
