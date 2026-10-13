const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const jwt = require("jsonwebtoken");
const User = require("../src/models/user");
const Notification = require("../src/models/notification");
const ConnectionRequest = require("../src/models/connectionRequest");
const { Chat } = require("../src/models/chat");

const io = { use(handler) { this.authenticate = handler; }, on(event, handler) { if (event === "connection") this.connect = handler; }, to() { return { emit: (event, data) => this.sent.push({ event, data }) }; }, sent: [] };
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === "socket.io") return () => io;
  return originalLoad.call(this, name, ...args);
};
const initializeSocket = require("../src/utils/socket");
Module._load = originalLoad;
initializeSocket({});
process.env.JWT_SECRET = "socket_test_secret";
const userId = "507f1f77bcf86cd799439011";
const targetUserId = "507f1f77bcf86cd799439012";

const connect = async (cookie) => {
  const socket = { handshake: { headers: { cookie } }, handlers: {}, errors: [], rooms: [], on(event, handler) { this.handlers[event] = handler; }, emit(event, data) { this.errors.push({ event, data }); }, to(room) { return { emit: (event, data) => io.sent.push({ room, event, data }) }; }, async join(room) { this.rooms.push(room); } };
  const error = await new Promise((resolve) => io.authenticate(socket, resolve));
  if (!error) io.connect(socket);
  return { socket, error };
};

const setup = (t) => {
  t.mock.method(Notification, "create", async (details) => details);
  const user = { _id: userId, firstName: "Actual", isPremium: false };
  let count = 0;
  const chat = { messages: [], async save() {} };
  io.sent = [];
  t.mock.method(User, "findById", async () => user);
  t.mock.method(User, "updateOne", async () => {});
  t.mock.method(User, "findOneAndUpdate", async () => ++count <= 10 ? user : null);
  t.mock.method(ConnectionRequest, "findOne", async () => ({ status: "accepted" }));
  t.mock.method(Chat, "findOne", async () => chat);
  return { user, chat };
};
const cookie = () => "token=" + jwt.sign({ _id: userId }, process.env.JWT_SECRET);

test("sockets reject missing or invalid sessions", async (t) => {
  setup(t);
  assert.match((await connect("")).error.message, /Unauthorized/);
  assert.match((await connect("token=invalid")).error.message, /Unauthorized/);
});

test("room joins and sends require an accepted connection", async (t) => {
  const { chat } = setup(t);
  ConnectionRequest.findOne.mock.mockImplementation(async () => null);
  const { socket } = await connect(cookie());
  await socket.handlers.joinChat({ targetUserId });
  await socket.handlers.sendMessage({ targetUserId, text: "Hello" });
  assert.deepEqual(socket.rooms, ["user_" + userId]);
  assert.equal(chat.messages.length, 0);
  assert.equal(User.findOneAndUpdate.mock.calls.length, 0);
  assert.match(socket.errors[0].data.message, /not connected/);
});

test("messages use the session identity and free sends stop after ten", async (t) => {
  const { chat } = setup(t);
  const { socket } = await connect(cookie());
  let acknowledgement;
  for (let i = 0; i < 11; i++) {
    await socket.handlers.sendMessage({ targetUserId, userId: "spoofed", firstName: "Spoofed", text: " Hello " }, (data) => { acknowledgement = data; });
  }
  assert.equal(chat.messages.length, 10);
  assert.equal(chat.messages[0].senderId, userId);
  assert.equal(chat.messages[0].text, "Hello");
  assert.equal(io.sent.find((event) => event.event === "receiveMessage").data.firstName, "Actual");
  assert.equal(io.sent.find((event) => event.event === "receiveMessage").data.senderId, userId);
  assert.equal(acknowledgement.success, false);
  assert.equal(socket.errors.at(-1).data.code, "DAILY_LIMIT");
});

test("paid messaging exceeds ten and an expiry during the socket session restores limits", async (t) => {
  const { user, chat } = setup(t);
  Object.assign(user, { isPremium: true, membershipType: "platinum", membershipValidUntil: new Date(Date.now() + 86400000) });
  const { socket } = await connect(cookie());
  for (let i = 0; i < 15; i++) await socket.handlers.sendMessage({ targetUserId, text: "Paid message" });
  assert.equal(chat.messages.length, 15);
  assert.equal(User.findOneAndUpdate.mock.calls.length, 0);
  user.membershipValidUntil = new Date(0);
  for (let i = 0; i < 11; i++) await socket.handlers.sendMessage({ targetUserId, text: "Free message" });
  assert.equal(chat.messages.length, 25);
  assert.equal(socket.errors.at(-1).data.code, "DAILY_LIMIT");
});

test("invalid messages do not consume quota", async (t) => {
  setup(t);
  const { socket } = await connect(cookie());
  for (const text of ["   ", "a".repeat(2001), 123]) await socket.handlers.sendMessage({ targetUserId, text });
  assert.equal(User.findOneAndUpdate.mock.calls.length, 0);
  assert.equal(io.sent.length, 0);
});

test("typing uses session identity, stops explicitly, and never consumes message quota", async (t) => {
  setup(t);
  const { socket } = await connect(cookie());
  await socket.handlers.typing({ targetUserId, senderId: "spoofed", isTyping: true });
  await socket.handlers.typing({ targetUserId, isTyping: true });
  await socket.handlers.typing({ targetUserId, isTyping: false });
  const typing = io.sent.filter((event) => event.event === "typing");
  assert.equal(typing.length, 2);
  assert.equal(typing[0].data.senderId, userId);
  assert.equal(typing[0].data.isTyping, true);
  assert.equal(typing[1].data.isTyping, false);
  assert.equal(User.findOneAndUpdate.mock.calls.length, 0);
});

test("unconnected users cannot broadcast typing events", async (t) => {
  setup(t);
  ConnectionRequest.findOne.mock.mockImplementation(async () => null);
  const { socket } = await connect(cookie());
  await socket.handlers.typing({ targetUserId, isTyping: true });
  assert.equal(io.sent.filter((event) => event.event === "typing").length, 0);
});
