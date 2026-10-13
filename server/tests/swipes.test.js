const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const User = require("../src/models/user");
const ConnectionRequest = require("../src/models/connectionRequest");
const sendEmail = require("../src/utils/sendEmail");
const router = require("../src/routes/request");
process.env.JWT_SECRET = "swipe_test_secret";
const userId = "507f1f77bcf86cd799439011";
const targetUserId = "507f1f77bcf86cd799439012";

const request = (status, target = targetUserId) => new Promise((resolve, reject) => {
  const req = { method: "POST", url: "/request/send/" + status + "/" + target, cookies: { token: jwt.sign({ _id: userId }, process.env.JWT_SECRET) } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { resolve({ status: this.statusCode, data }); }, send(data) { resolve({ status: this.statusCode, data }); } };
  router.handle(req, res, (err) => reject(err || new Error("Route not found")));
});

const setup = (t) => {
  const user = { _id: userId, firstName: "Test", isPremium: false };
  let count = 0;
  t.mock.method(User, "findById", async (id) => typeof id === "object" ? user : { _id: targetUserId, firstName: "Target" });
  t.mock.method(User, "updateOne", async () => {});
  t.mock.method(User, "findOneAndUpdate", async () => ++count <= 10 ? user : null);
  t.mock.method(ConnectionRequest, "findOne", async () => null);
  t.mock.method(ConnectionRequest.prototype, "save", async function () { return this; });
  t.mock.method(sendEmail, "run", async () => {});
  return user;
};

test("both swipe directions share a ten-action daily limit", async (t) => {
  setup(t);
  for (let i = 0; i < 10; i++) assert.equal((await request(i % 2 ? "ignored" : "interested")).status, 200);
  const result = await request("ignored");
  assert.equal(result.status, 429);
  assert.equal(result.data.code, "DAILY_LIMIT");
  assert.equal(ConnectionRequest.prototype.save.mock.calls.length, 10);
});

test("paid swipes exceed ten without reserving free quota", async (t) => {
  const user = setup(t);
  Object.assign(user, { isPremium: true, membershipType: "gold", membershipValidUntil: new Date(Date.now() + 86400000) });
  for (let i = 0; i < 15; i++) assert.equal((await request("ignored")).status, 200);
  assert.equal(User.findOneAndUpdate.mock.calls.length, 0);
});

test("invalid or duplicate swipes do not reserve quota", async (t) => {
  setup(t);
  assert.equal((await request("accepted")).status, 400);
  assert.equal((await request("ignored", userId)).status, 400);
  assert.equal((await request("ignored", "invalid")).status, 400);
  ConnectionRequest.findOne.mock.mockImplementation(async () => ({ status: "interested" }));
  assert.equal((await request("ignored")).status, 400);
  assert.equal(User.findOneAndUpdate.mock.calls.length, 0);
});

test("notification failures do not turn saved swipes into failed requests", async (t) => {
  setup(t);
  t.mock.method(console, "error", () => {});
  sendEmail.run.mock.mockImplementation(async () => { throw new Error("SES unavailable"); });
  assert.equal((await request("interested")).status, 200);
  assert.equal(ConnectionRequest.prototype.save.mock.calls.length, 1);
});

test("failed saves release reserved swipe quota", async (t) => {
  setup(t);
  ConnectionRequest.prototype.save.mock.mockImplementation(async () => { throw new Error("Save failed"); });
  assert.equal((await request("ignored")).status, 400);
  const release = User.updateOne.mock.calls.at(-1).arguments[1];
  assert.equal(release.$inc["dailyUsage.swipes"], -1);
});
