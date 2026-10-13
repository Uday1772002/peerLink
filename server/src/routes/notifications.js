const express = require("express");
const mongoose = require("mongoose");
const userAuth = require("../middlewares/auth");
const Notification = require("../models/notification");
const notificationRouter = express.Router();

notificationRouter.get("/notifications", userAuth, async (req, res) => {
  try {
    const [data, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user._id }).sort({ readAt: 1, createdAt: -1 }).limit(30),
      Notification.countDocuments({ userId: req.user._id, readAt: null }),
    ]);
    res.json({ data, unreadCount });
  } catch (err) {
    res.status(500).json({ message: "Unable to load notifications" });
  }
});

notificationRouter.patch("/notifications/read", userAuth, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    if (!Array.isArray(notificationIds) || notificationIds.length > 100 || !notificationIds.every((id) => mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "Invalid notifications" });
    }
    await Notification.updateMany(
      { _id: { $in: notificationIds }, userId: req.user._id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    req.app?.get("io")?.to("user_" + req.user._id).emit("notificationUpdated");
    res.json({ message: "Notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Unable to update notifications" });
  }
});

module.exports = notificationRouter;
