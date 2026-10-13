const express = require("express");
const mongoose = require("mongoose");
const Notification = require("../models/notification");
const userAuth = require("../middlewares/auth");
const { Chat } = require("../models/chat");
const { checkChatConnection } = require("../utils/chatAccess");

const chatRouter = express.Router();

chatRouter.get("/chat/unread", userAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const data = await Chat.aggregate([
      { $match: { participants: userId } },
      { $unwind: "$messages" },
      { $match: { "messages.senderId": { $ne: userId }, "messages.readAt": null } },
      { $group: { _id: "$messages.senderId", count: { $sum: 1 } } },
    ]);
    res.json({ data, unreadCount: data.reduce((count, chat) => count + chat.count, 0) });
  } catch (err) {
    res.status(500).json({ message: "Unable to load unread messages" });
  }
});

chatRouter.patch("/chat/:targetUserId/read", userAuth, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { messageIds } = req.body;
    await checkChatConnection(req.user._id, targetUserId);
    if (!Array.isArray(messageIds) || messageIds.length > 5000 || !messageIds.every((id) => mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "Invalid message IDs" });
    }
    const readAt = new Date();
    await Chat.updateOne(
      { participants: { $all: [req.user._id, targetUserId] } },
      { $set: { "messages.$[message].readAt": readAt } },
      { arrayFilters: [{ "message._id": { $in: messageIds }, "message.senderId": new mongoose.Types.ObjectId(targetUserId), "message.readAt": null }] },
    );
    await Notification.updateMany(
      { userId: req.user._id, fromUserId: targetUserId, type: "message", messageId: { $in: messageIds }, readAt: null },
      { $set: { readAt } },
    );
    const io = req.app?.get("io");
    io?.to("user_" + req.user._id).emit("chatUpdated");
    io?.to("user_" + req.user._id).emit("notificationUpdated");
    res.json({ message: "Messages marked as read", readAt });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

chatRouter.get("/chat/:targetUserId", userAuth, async (req, res) => {
  const { targetUserId } = req.params;
  const userId = req.user._id;
  try {
    await checkChatConnection(userId, targetUserId);
    let chat = await Chat.findOne({
      participants: { $all: [userId, targetUserId] },
    }).populate({ path: "messages.senderId", select: "firstName lastName" });
    if (!chat) {
      chat = new Chat({
        participants: [userId, targetUserId],
        messages: [],
      });

    }
    res.json(chat);
  } catch (err) {
    console.error("Error fetching chat:", err);
    res.status(403).json({ message: err.message });
  }
});

module.exports = chatRouter;
