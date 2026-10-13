const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/user");
const { isPremiumUser, getMembershipExpiry, getDailyUsage, reserveDailyUsage, releaseDailyUsage } = require("../src/utils/membership");

const paidUser = (type = "silver") => ({ _id: "507f1f77bcf86cd799439011", isPremium: true, membershipType: type, membershipValidUntil: new Date(Date.now() + 86400000) });

test("only unexpired paid memberships unlock access", () => {
  for (const type of ["silver", "gold", "platinum", "premium"]) assert.equal(isPremiumUser(paidUser(type)), true);
  assert.equal(isPremiumUser({ ...paidUser(), membershipValidUntil: new Date(0) }), false);
  assert.equal(isPremiumUser({ ...paidUser(), membershipValidUntil: undefined }), false);
  assert.equal(isPremiumUser(paidUser("invalid")), false);
  assert.equal(isPremiumUser({ isPremium: false }), false);
});

test("plan durations handle month ends and leap years", () => {
  assert.equal(getMembershipExpiry("silver", "2026-01-31T10:00:00Z").toISOString(), "2026-02-28T10:00:00.000Z");
  assert.equal(getMembershipExpiry("gold", "2026-01-31T10:00:00Z").toISOString(), "2026-04-30T10:00:00.000Z");
  assert.equal(getMembershipExpiry("platinum", "2024-02-29T10:00:00Z").toISOString(), "2025-02-28T10:00:00.000Z");
  assert.throws(() => getMembershipExpiry("bad", new Date()), /Invalid membership/);
});

test("daily usage resets stale days and represents unlimited access", () => {
  assert.deepEqual(getDailyUsage({ dailyUsage: { date: "2020-01-01", messages: 10, swipes: 10 } }), { date: new Date().toISOString().slice(0, 10), messages: 0, swipes: 0, limit: 10 });
  assert.equal(getDailyUsage(paidUser()).limit, null);
});

test("free quotas reject action 11, count swipes separately, and release failed actions", async (t) => {
  const user = { _id: "507f1f77bcf86cd799439011", isPremium: false };
  const date = new Date().toISOString().slice(0, 10);
  const usage = { date: "yesterday", messages: 10, swipes: 10 };
  t.mock.method(User, "updateOne", async (filter, update) => {
    if (update.$set && usage.date !== date) Object.assign(usage, update.$set.dailyUsage);
    if (update.$inc && usage.date === filter["dailyUsage.date"]) {
      const field = Object.keys(update.$inc)[0].split(".")[1];
      if (usage[field] > 0) usage[field] += update.$inc["dailyUsage." + field];
    }
  });
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    const field = Object.keys(update.$inc)[0].split(".")[1];
    assert.equal(filter["dailyUsage." + field].$lt, 10);
    assert.equal(filter["dailyUsage.date"], date);
    if (usage[field] >= 10) return null;
    usage[field]++;
    return user;
  });
  const attempts = await Promise.allSettled(Array.from({ length: 15 }, () => reserveDailyUsage(user, "messages")));
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 10);
  assert.equal(attempts.filter((result) => result.status === "rejected" && result.reason.code === "DAILY_LIMIT").length, 5);
  assert.equal(usage.messages, 10);
  assert.equal(usage.swipes, 0);
  await reserveDailyUsage(user, "swipes");
  assert.equal(usage.swipes, 1);
  await releaseDailyUsage(user._id, "messages", date);
  assert.equal(usage.messages, 9);
  await reserveDailyUsage(user, "messages");
  assert.equal(usage.messages, 10);
  await releaseDailyUsage(user._id, "messages", "yesterday");
  assert.equal(usage.messages, 10);
});

test("paid users bypass quota storage, expired memberships do not", async (t) => {
  t.mock.method(User, "updateOne", async () => {});
  t.mock.method(User, "findOneAndUpdate", async () => null);
  assert.equal(await reserveDailyUsage(paidUser(), "messages"), null);
  assert.equal(await reserveDailyUsage(paidUser(), "swipes"), null);
  assert.equal(User.updateOne.mock.calls.length, 0);
  await assert.rejects(reserveDailyUsage({ ...paidUser(), membershipValidUntil: new Date(0) }, "messages"), { code: "DAILY_LIMIT" });
});

test("user JSON never exposes password hashes", () => {
  const user = new User({ firstName: "Test", email: "test@example.com", password: "hash" });
  assert.equal(user.toJSON().password, undefined);
});
