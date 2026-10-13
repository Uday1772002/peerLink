const Notification = require("../models/notification");

const createNotification = async (io, details) => {
  try {
    const notification = await Notification.create(details);
    io?.to("user_" + details.userId).emit("notification", notification);
  } catch (err) {
    console.error("Unable to create notification:", err.message);
  }
};

module.exports = { createNotification };
