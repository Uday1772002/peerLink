const express = require("express");
const userAuth = require("../middlewares/auth");
const ConnectionRequest = require("../models/connectionRequest");
const User = require("../models/user");

const userRouter = express.Router();
const USER_SAFE_DATA = "firstName lastName photoUrl age gender about skills isPremium membershipType membershipValidUntil";
userRouter.get("/user/requests/received", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const connectionRequest = await ConnectionRequest.find({
      toUserId: loggedInUser._id,
      status: "interested",
    }).populate(
      "fromUserId",
      "firstName lastName photoUrl age gender about skills isPremium membershipType membershipValidUntil",
    );
    res.json({
      message: "Data Fetched Successfully",
      data: connectionRequest,
    });
  } catch (err) {
    res.status(404).send("Error", +err.message);
  }
});

userRouter.get("/user/connections", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const connectionRequests = await ConnectionRequest.find({
      $or: [
        { fromUserId: loggedInUser._id, status: "accepted" },
        { toUserId: loggedInUser._id, status: "accepted" },
      ],
    })
      .populate("fromUserId", USER_SAFE_DATA)
      .populate("toUserId", USER_SAFE_DATA);

    const data = connectionRequests.map((row) => {
      if (row.fromUserId._id.toString() === loggedInUser._id.toString()) {
        return row.toUserId;
      }
      return row.fromUserId;
    });
    res.json({ data });
  } catch (err) {
    res.status(404).send("Connections not found");
  }
});

userRouter.get("/user/feed", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    limit = limit > 100 ? 100 : limit;
    const skip = (page - 1) * limit;

    const connectionRequests = await ConnectionRequest.find({
      $or: [{ fromUserId: loggedInUser._id }, { toUserId: loggedInUser._id }],
    }).select("fromUserId toUserId");

    const hideUsersFromFeed = new Set();
    connectionRequests.forEach((req) => {
      hideUsersFromFeed.add(req.fromUserId.toString());
      hideUsersFromFeed.add(req.toUserId.toString());
    });
    console.log(hideUsersFromFeed);

    const user = await User.find({
      $and: [
        { _id: { $nin: Array.from(hideUsersFromFeed) } },
        { _id: { $ne: loggedInUser._id } },
      ],
    })
      .select(USER_SAFE_DATA)
      .skip(skip)
      .limit(limit);
    res.json({ data: user });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
});

userRouter.get("/user/requests/sent", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const sentRequests = await ConnectionRequest.find({
      fromUserId: loggedInUser._id,
      status: "interested",
    }).populate("toUserId", USER_SAFE_DATA);
    res.json({ message: "Data Fetched Successfully", data: sentRequests });
  } catch (err) {
    res.status(404).send("Error: " + err.message);
  }
});

module.exports = userRouter;
