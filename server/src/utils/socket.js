const socket = require("socket.io");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Chat } = require("../models/chat");
const User = require("../models/user");
const { createNotification } = require("./notifications");
const { checkChatConnection } = require("./chatAccess");
const { reserveDailyUsage, releaseDailyUsage } = require("./membership");

const getSecretRoomId = (userId, targetUserId) => {
  return crypto.createHash("sha256").update([String(userId), String(targetUserId)].sort().join("_")).digest("hex");
};

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: ["https://devtinder.space", "http://localhost:3000", "http://localhost:5173"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie || "";
      const tokenCookie = cookie.split(";").find((value) => value.trim().startsWith("token="));
      if (!tokenCookie) throw new Error("Unauthorized");
      const token = decodeURIComponent(tokenCookie.trim().slice(6));
      const { _id } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(_id);
      if (!user) throw new Error("Unauthorized");
      socket.userId = String(user._id);
      socket.token = token;
      next();
    } catch {
      next(new Error("Unauthorized: Please log in again"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("user_" + socket.userId);
    socket.on("joinChat", async ({ targetUserId } = {}, acknowledge) => {
      try {
        jwt.verify(socket.token, process.env.JWT_SECRET);
        await checkChatConnection(socket.userId, targetUserId);
        await socket.join(getSecretRoomId(socket.userId, targetUserId));
        if (typeof acknowledge === "function") acknowledge({ success: true });
      } catch (err) {
        socket.emit("errorMessage", { message: err.message });
        if (typeof acknowledge === "function") acknowledge({ success: false });
      }
    });

    socket.on("typing", async ({ targetUserId, isTyping } = {}) => {
      try {
        jwt.verify(socket.token, process.env.JWT_SECRET);
        if (typeof isTyping !== "boolean") return;
        if (isTyping && Date.now() - (socket.lastTypingAt || 0) < 500) return;
        socket.lastTypingAt = Date.now();
        await checkChatConnection(socket.userId, targetUserId);
        socket.to(getSecretRoomId(socket.userId, targetUserId)).emit("typing", {
          senderId: socket.userId, isTyping,
        });
      } catch (err) {
        socket.emit("errorMessage", { message: err.message });
      }
    });

    socket.on("sendMessage", async ({ text, targetUserId } = {}, acknowledge) => {
      let usageDate;
      let messageSaved = false;
      try {
        jwt.verify(socket.token, process.env.JWT_SECRET);
        if (typeof text !== "string" || !text.trim() || text.trim().length > 2000) {
          throw new Error("Messages must contain between 1 and 2000 characters.");
        }
        await checkChatConnection(socket.userId, targetUserId);
        const user = await User.findById(socket.userId);
        if (!user) throw new Error("User not found");
        usageDate = await reserveDailyUsage(user, "messages");
        let chat = await Chat.findOne({ participants: { $all: [socket.userId, targetUserId] } });
        if (!chat) {
          chat = new Chat({ participants: [socket.userId, targetUserId], messages: [] });
        }
        chat.messages.push({ senderId: socket.userId, text: text.trim() });
        await chat.save();
        messageSaved = true;
        const message = chat.messages[chat.messages.length - 1];
        await createNotification(io, {
          userId: targetUserId, fromUserId: socket.userId,
          type: "message", text: user.firstName + " sent you a message",
          messageId: message._id,
        });
        io.to("user_" + targetUserId).emit("chatUpdated");
        const chatRoom = getSecretRoomId(socket.userId, targetUserId);
        await socket.join(chatRoom);
        io.to(chatRoom).emit("receiveMessage", {
          _id: message._id,
          firstName: user.firstName,
          text: text.trim(),
          senderId: socket.userId,
          createdAt: message.createdAt,
          readAt: message.readAt,
        });
        if (typeof acknowledge === "function") acknowledge({ success: true });
      } catch (err) {
        if (!messageSaved) {
          try {
            await releaseDailyUsage(socket.userId, "messages", usageDate);
          } catch (releaseError) {
            console.error("Unable to release message usage:", releaseError.message);
          }
        }
        const error = { message: err.message, code: err.code };
        socket.emit("errorMessage", error);
        if (typeof acknowledge === "function") acknowledge({ success: false, ...error });
      }
    });
  });
  return io;
};

module.exports = initializeSocket;
