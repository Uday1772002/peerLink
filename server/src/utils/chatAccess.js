const mongoose = require("mongoose");
const ConnectionRequest = require("../models/connectionRequest");

const checkChatConnection = async (userId, targetUserId) => {
  if (!mongoose.isValidObjectId(targetUserId) || String(userId) === String(targetUserId)) {
    throw new Error("Invalid chat user");
  }
  const connection = await ConnectionRequest.findOne({
    status: "accepted",
    $or: [
      { fromUserId: userId, toUserId: targetUserId },
      { fromUserId: targetUserId, toUserId: userId },
    ],
  });
  if (!connection) throw new Error("You are not connected with this user.");
};

module.exports = { checkChatConnection };
