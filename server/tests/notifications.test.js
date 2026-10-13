const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../src/models/user");
const Notification = require("../src/models/notification");
const ConnectionRequest = require("../src/models/connectionRequest");
const { Chat } = require("../src/models/chat");
const notificationRouter = require("../src/routes/notifications");
const chatRouter = require("../src/routes/chat");
const { createNotification } = require("../src/utils/notifications");
process.env.JWT_SECRET = "notification_test_secret";
const userId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
const targetUserId = "507f1f77bcf86cd799439012";
const messageId = "507f1f77bcf86cd799439013";
const notificationId = "507f1f77bcf86cd799439014";
const events = [];
const io = { to(room) { return { emit(event, data) { events.push({ room, event, data }); } }; } };

const request = (router, method, url, body = {}, authenticated = true) => new Promise((resolve, reject) => {
  const req = { method, url, body, cookies: authenticated ? { token: jwt.sign({ _id: userId }, process.env.JWT_SECRET) } : {}, app: { get: () => io } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { resolve({ status: this.statusCode, data }); }, send(data) { resolve({ status: this.statusCode, data }); } };
  router.handle(req, res, (err) => reject(err || new Error("Route not found")));
});

const setup = (t) => {
  events.length = 0;
  t.mock.method(User, "findById", async () => ({ _id: userId, isPremium: false }));
  t.mock.method(ConnectionRequest, "findOne", async () => ({ status: "accepted" }));
  t.mock.method(Chat, "updateOne", async () => ({ matchedCount: 1 }));
  t.mock.method(Notification, "updateMany", async () => {});
};

test("notifications require login and list only the signed-in user's data", async (t) => {
  setup(t);
  t.mock.method(Notification, "find", (filter) => {
    assert.equal(String(filter.userId), String(userId));
    return { sort(order) { assert.equal(order.readAt, 1); return { limit(size) { assert.equal(size, 30); return Promise.resolve([{ _id: notificationId }]); } }; } };
  });
  t.mock.method(Notification, "countDocuments", async (filter) => {
    assert.equal(String(filter.userId), String(userId));
    assert.equal(filter.readAt, null);
    return 3;
  });
  assert.equal((await request(notificationRouter, "GET", "/notifications", {}, false)).status, 401);
  const result = await request(notificationRouter, "GET", "/notifications");
  assert.equal(result.status, 200);
  assert.equal(result.data.unreadCount, 3);
});

test("marking notifications read is owner-scoped and does not mark chat messages read", async (t) => {
  setup(t);
  assert.equal((await request(notificationRouter, "PATCH", "/notifications/read", { notificationIds: [notificationId] })).status, 200);
  const filter = Notification.updateMany.mock.calls[0].arguments[0];
  assert.equal(String(filter.userId), String(userId));
  assert.deepEqual(filter._id.$in, [notificationId]);
  assert.equal(Chat.updateOne.mock.calls.length, 0);
  assert.equal(events[0].room, "user_" + userId);
  assert.equal(events[0].event, "notificationUpdated");
});

test("invalid notification IDs are rejected before updating data", async (t) => {
  setup(t);
  for (const notificationIds of [undefined, ["bad"], Array(101).fill(notificationId)]) {
    assert.equal((await request(notificationRouter, "PATCH", "/notifications/read", { notificationIds })).status, 400);
  }
  assert.equal(Notification.updateMany.mock.calls.length, 0);
});

test("unread counts exclude the user's sent and already-read messages", async (t) => {
  setup(t);
  t.mock.method(Chat, "aggregate", async (pipeline) => {
    assert.equal(String(pipeline[0].$match.participants), String(userId));
    assert.equal(String(pipeline[2].$match["messages.senderId"].$ne), String(userId));
    assert.equal(pipeline[2].$match["messages.readAt"], null);
    return [{ _id: targetUserId, count: 2 }, { _id: notificationId, count: 3 }];
  });
  const result = await request(chatRouter, "GET", "/chat/unread");
  assert.equal(result.status, 200);
  assert.equal(result.data.unreadCount, 5);
});

test("read updates target only displayed incoming messages and their notifications", async (t) => {
  setup(t);
  const result = await request(chatRouter, "PATCH", "/chat/" + targetUserId + "/read", { messageIds: [messageId] });
  assert.equal(result.status, 200);
  const [filter, update, options] = Chat.updateOne.mock.calls[0].arguments;
  assert.deepEqual(filter.participants.$all.map(String), [String(userId), targetUserId]);
  assert.deepEqual(options.arrayFilters[0]["message._id"].$in, [messageId]);
  assert.equal(String(options.arrayFilters[0]["message.senderId"]), targetUserId);
  assert.ok(update.$set["messages.$[message].readAt"] instanceof Date);
  const notificationFilter = Notification.updateMany.mock.calls[0].arguments[0];
  assert.equal(String(notificationFilter.userId), String(userId));
  assert.equal(notificationFilter.type, "message");
  assert.deepEqual(notificationFilter.messageId.$in, [messageId]);
});

test("unconnected users cannot change chat read state", async (t) => {
  setup(t);
  ConnectionRequest.findOne.mock.mockImplementation(async () => null);
  const result = await request(chatRouter, "PATCH", "/chat/" + targetUserId + "/read", { messageIds: [messageId] });
  assert.equal(result.status, 403);
  assert.equal(Chat.updateOne.mock.calls.length, 0);
  assert.equal(Notification.updateMany.mock.calls.length, 0);
});

test("notification creation persists before delivery and routes to the recipient's personal room", async (t) => {
  setup(t);
  t.mock.method(Notification, "create", async (details) => ({ ...details, _id: notificationId }));
  await createNotification(io, { userId: targetUserId, fromUserId: userId, type: "message", text: "New message", messageId });
  assert.equal(events[0].room, "user_" + targetUserId);
  assert.equal(events[0].event, "notification");
  assert.equal(events[0].data.messageId, messageId);
});

test("notification storage failures do not reject a saved action", async (t) => {
  setup(t);
  t.mock.method(console, "error", () => {});
  t.mock.method(Notification, "create", async () => { throw new Error("Storage failed"); });
  await assert.doesNotReject(createNotification(io, { userId: targetUserId }));
  assert.equal(events.length, 0);
});
