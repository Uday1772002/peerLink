const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../src/models/user");
const ConnectionRequest = require("../src/models/connectionRequest");
const router = require("../src/routes/user");
process.env.JWT_SECRET = "feed_test_secret";
const userId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
const otherId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439012");

const request = (query) => new Promise((resolve, reject) => {
  const req = { method: "GET", url: "/user/feed", query, cookies: { token: jwt.sign({ _id: userId }, process.env.JWT_SECRET) } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { resolve({ status: this.statusCode, data }); }, send(data) { resolve({ status: this.statusCode, data }); } };
  router.handle(req, res, (err) => reject(err || new Error("Route not found")));
});

const setup = (t) => {
  t.mock.method(User, "findById", async () => ({ _id: userId, isPremium: false }));
  t.mock.method(ConnectionRequest, "find", () => ({ select: async () => [{ fromUserId: userId, toUserId: otherId }] }));
};

test("filtered feeds preserve self and existing-request exclusions and expose showcase fields", async (t) => {
  setup(t);
  t.mock.method(User, "find", (filter) => {
    assert.equal(String(filter.$and[1]._id.$ne), String(userId));
    assert.ok(filter.$and[0]._id.$nin.includes(String(otherId)));
    assert.equal(filter.$and[2].skills.$in[0].test("React"), true);
    assert.equal(filter.$and[3].location.test("Bengaluru"), true);
    return { select(fields) {
      for (const field of ["githubUrl", "projects", "location", "experienceLevel", "interests"]) assert.ok(fields.split(" ").includes(field));
      assert.equal(fields.includes("password"), false);
      return { skip(value) { assert.equal(value, 0); return { limit(value) { assert.equal(value, 10); return Promise.resolve([{ firstName: "Match" }]); } }; } };
    } };
  });
  const result = await request({ skills: "React", location: "Bengaluru" });
  assert.equal(result.status, 200);
  assert.equal(result.data.data[0].firstName, "Match");
});

test("invalid filter queries are rejected without searching users", async (t) => {
  setup(t);
  t.mock.method(User, "find", () => { throw new Error("Should not run"); });
  const result = await request({ experienceLevel: "bad" });
  assert.equal(result.status, 400);
  assert.equal(User.find.mock.calls.length, 0);
});
