const express = require("express");
const userAuth = require("../middlewares/auth");
const { Chat } = require("../models/chat");
const { checkChatConnection } = require("../utils/chatAccess");

const chatRouter = express.Router();

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
