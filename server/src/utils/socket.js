const socket = require("socket.io");
const crypto = require("crypto");
const { Chat } = require("../models/chat");
const connectionRequest = require("../models/connectionRequest");
const redisConfig = require("../config/redis");
const { redisClient } = redisConfig;
const User = require("../models/user");
const mongoose = require("mongoose");

const getSecretRoomId = (userId, targetUserId) => {
  return crypto
    .createHash("sha256")
    .update([userId, targetUserId].sort().join("_"))
    .digest("hex");
};

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: [
        "https://devtinder.space",
        "http://localhost:3000",
        "http://localhost:5173",
      ],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("joinChat", ({ firstName, userId, targetUserId }) => {
      // create a unique chat room for this user and target user
      const chatRoom = getSecretRoomId(userId, targetUserId);
      socket.join(chatRoom);
      console.log(`Socket ${socket.id} joined room ${chatRoom}`);
    });

    socket.on(
      "sendMessage",
      async ({ firstName, text, userId, targetUserId }) => {
        try {
          let currentCount = 0;
          if (redisConfig.isRedisAvailable) {
            const redisKey = `rate_limit:${userId}`;
            currentCount = await redisClient.incr(redisKey);
            if (currentCount === 1) {
              await redisClient.expire(redisKey, 86400);
            }
          }

          const user = await User.findById(userId);
          console.log("isPremium:", user?.isPremium, "count:", currentCount);

          if (!user || !user.isPremium) {
            const dailyLimit = redisConfig.isRedisAvailable
              ? 10
              : Number.MAX_SAFE_INTEGER;
            if (currentCount > dailyLimit) {
              return socket.emit(
                "errorMessage",
                "You have reached your daily message limit. Upgrade to premium for unlimited messaging.",
              );
            }
          }

          const connection = await connectionRequest.findOne({
            $or: [
              {
                fromUserId: new mongoose.Types.ObjectId(userId),
                toUserId: new mongoose.Types.ObjectId(targetUserId),
                status: "accepted",
              },
              {
                fromUserId: new mongoose.Types.ObjectId(targetUserId),
                toUserId: new mongoose.Types.ObjectId(userId),
                status: "accepted",
              },
            ],
          });

          if (!connection) {
            return socket.emit(
              "errorMessage",
              "You are not connected with this user.",
            );
          }
          const chatRoom = getSecretRoomId(userId, targetUserId);
          let chat = await Chat.findOne({
            participants: { $all: [userId, targetUserId] },
          });

          if (!chat) {
            chat = new Chat({
              participants: [userId, targetUserId],
              messages: [],
            });
          }

          chat.messages.push({ senderId: userId, text });
          await chat.save();
          // emit the message to everyone in the chat room except the sender
          io.to(chatRoom).emit("receiveMessage", {
            firstName,
            text,
            senderId: userId,
          });
        } catch (err) {
          console.error("Error emitting message:", err);
        }
      },
    );

    socket.on("disconnect", () => {
      // console.log("Client disconnected: " + socket.id);
    });
  });
};

module.exports = initializeSocket;
