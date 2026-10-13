const express = require("express");
const userAuth = require("../middlewares/auth");
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/user");
const sendEmail = require("../utils/sendEmail");
const mongoose = require("mongoose");
const { createNotification } = require("../utils/notifications");
const { reserveDailyUsage, releaseDailyUsage } = require("../utils/membership");

const requestRouter = express.Router();

requestRouter.post(
  "/request/send/:status/:toUserId",
  userAuth,
  async (req, res) => {
    let usageDate;
    let requestSaved = false;
    try {
      const fromUserId = req.user._id;
      const toUserId = req.params.toUserId;
      const status = req.params.status;

      const allowedStatus = ["ignored", "interested"];
      if (!allowedStatus.includes(status)) {
        return res
          .status(400)
          .json({ message: "invalid Status Type: " + status });
      }

      if (!mongoose.isValidObjectId(toUserId) || fromUserId.toString() === toUserId) {
        return res.status(400).json({ message: "Invalid target user" });
      }

      //finding if we already sent request or not to prevent duplicate entries
      const existingConnectionRequest = await ConnectionRequest.findOne({
        $or: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      });

      if (existingConnectionRequest) {
        return res.status(400).json({ message: "Request Sent already" });
      }

      const toUser = await User.findById(toUserId);

      if (!toUser) {
        return res.status(400).json({ message: "User doesn't Exits" });
      }

      usageDate = await reserveDailyUsage(req.user, "swipes");
      const connectionRequest = new ConnectionRequest({
        fromUserId,
        toUserId,
        status,
      });

      const data = await connectionRequest.save();
      requestSaved = true;

      if (status === "interested") {
        await createNotification(req.app?.get("io"), {
          userId: toUserId, fromUserId, type: "request",
          text: req.user.firstName + " sent you a connection request",
        });
        try {
          await sendEmail.run(
            req.user.firstName + " is interested in connecting with " + toUser.firstName + ".",
            "Connection Request Status",
          );
        } catch (err) {
          console.error("Email failed:", err.message);
        }
      }

      res.json({
        message:
          req.user.firstName + " is " + status + " in " + toUser.firstName,
        data,
      });
    } catch (err) {
      if (!requestSaved) await releaseDailyUsage(req.user._id, "swipes", usageDate);
      res.status(err.code === "DAILY_LIMIT" ? 429 : 400).json({ message: err.message, code: err.code });
    }
  },
);

requestRouter.post(
  "/request/review/:status/:requestId",
  userAuth,
  async (req, res) => {
    try {
      const loggedInUser = req.user;
      const { status, requestId } = req.params;
      const allowedStatus = ["accepted", "rejected"];
      // allowed status
      if (!allowedStatus.includes(status)) {
        return res
          .status(400)
          .json({ message: "invalid Status Type: " + status });
      }

      const connectionRequest = await ConnectionRequest.findOne({
        _id: requestId,
        toUserId: loggedInUser._id,
        status: "interested",
      });
      if (!connectionRequest) {
        return res
          .status(404)
          .json({ message: "connection Request not found" });
      }
      connectionRequest.status = status;

      const data = await connectionRequest.save();
      if (status === "accepted") {
        await createNotification(req.app?.get("io"), {
          userId: connectionRequest.fromUserId,
          fromUserId: loggedInUser._id, type: "connection",
          text: loggedInUser.firstName + " accepted your connection request",
        });
      }
      res.json({ message: "connection request" + status, data });
    } catch (err) {
      res.status(404).send("Error: ", err.message);
    }
  },
);
module.exports = requestRouter;
