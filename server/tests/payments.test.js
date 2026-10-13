const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
process.env.RAZORPAY_KEY_ID = "test_key";
process.env.RAZORPAY_KEY_SECRET = "test_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
process.env.JWT_SECRET = "test_jwt_secret";
const router = require("../src/routes/payments");
const User = require("../src/models/user");
const Payment = require("../src/models/payments");
const razorpay = require("../src/utils/razorpay");
const userId = "507f1f77bcf86cd799439011";
const payment = { _id: "507f1f77bcf86cd799439012", userId, orderId: "order_test", amount: 49900, currency: "INR", notes: { membershipType: "silver" }, createdAt: new Date() };
const captured = { id: "pay_test", order_id: payment.orderId, status: "captured", amount: payment.amount, currency: "INR" };
const signature = (body, secret) => crypto.createHmac("sha256", secret).update(body).digest("hex");
const checkout = { razorpay_order_id: payment.orderId, razorpay_payment_id: captured.id, razorpay_signature: signature(payment.orderId + "|" + captured.id, process.env.RAZORPAY_KEY_SECRET) };

const request = (method, url, body = {}, extras = {}) => new Promise((resolve, reject) => {
  const req = { method, url, body, headers: {}, cookies: { token: jwt.sign({ _id: userId }, process.env.JWT_SECRET) }, ...extras };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { resolve({ status: this.statusCode, data }); }, send(data) { resolve({ status: this.statusCode, data }); } };
  router.handle(req, res, (err) => reject(err || new Error("Route not found")));
});

const setup = (t) => {
  const user = { _id: userId, firstName: "Test", isPremium: false };
  t.mock.method(User, "findById", async () => user);
  t.mock.method(Payment, "findOne", async (filter) => {
    if (filter.userId) assert.equal(String(filter.userId), userId);
    return payment;
  });
  t.mock.method(Payment, "updateOne", async () => {});
  t.mock.method(User, "updateOne", async (filter, update) => {
    const expiry = update.$set.membershipValidUntil;
    assert.equal(filter.$or[2].membershipValidUntil.$lt, expiry);
    if (!user.membershipValidUntil || user.membershipValidUntil < expiry) Object.assign(user, update.$set);
  });
  t.mock.method(razorpay.payments, "fetch", async () => captured);
  return user;
};

test("checkout activates captured payment and callbacks keep the same expiry", async (t) => {
  const user = setup(t);
  const first = await request("POST", "/payment/verify", checkout);
  assert.equal(first.status, 200);
  assert.equal(first.data.isPremium, true);
  assert.equal(user.membershipType, "silver");
  const expiry = user.membershipValidUntil.toISOString();
  await request("POST", "/payment/verify", checkout);
  assert.equal(user.membershipValidUntil.toISOString(), expiry);
  assert.equal(Payment.updateOne.mock.calls[0].arguments[1].$set.paymentId, captured.id);
});

test("checkout rejects tampered signatures, missing fields, and another user's order", async (t) => {
  setup(t);
  assert.equal((await request("POST", "/payment/verify", {})).status, 400);
  assert.equal((await request("POST", "/payment/verify", { ...checkout, razorpay_signature: "invalid" })).status, 400);
  assert.equal(User.updateOne.mock.calls.length, 0);
  Payment.findOne.mock.mockImplementation(async () => null);
  assert.equal((await request("POST", "/payment/verify", checkout)).status, 404);
});

test("authorized and mismatched payments cannot activate membership", async (t) => {
  setup(t);
  razorpay.payments.fetch.mock.mockImplementation(async () => ({ ...captured, status: "authorized" }));
  assert.equal((await request("POST", "/payment/verify", checkout)).status, 202);
  for (const overrides of [{ amount: 1 }, { currency: "USD" }, { order_id: "other" }, { status: "failed" }]) {
    razorpay.payments.fetch.mock.mockImplementation(async () => ({ ...captured, ...overrides }));
    assert.equal((await request("POST", "/payment/verify", checkout)).status, 400);
  }
  assert.equal(User.updateOne.mock.calls.length, 0);
});

test("webhooks verify exact raw bytes and only captured events activate membership", async (t) => {
  const user = setup(t);
  const body = { event: "payment.captured", payload: { payment: { entity: captured } } };
  const rawBody = Buffer.from(JSON.stringify(body, null, 2));
  const headers = { "x-razorpay-signature": signature(rawBody, process.env.RAZORPAY_WEBHOOK_SECRET) };
  assert.equal((await request("POST", "/payment/webhook", body, { rawBody, headers })).status, 200);
  assert.equal(user.isPremium, true);
  const expiry = user.membershipValidUntil.toISOString();
  await request("POST", "/payment/webhook", body, { rawBody, headers });
  assert.equal(user.membershipValidUntil.toISOString(), expiry);
  assert.equal((await request("POST", "/payment/webhook", body, { rawBody: Buffer.from("{}"), headers })).status, 400);
  const failed = { ...body, event: "payment.failed" };
  const failedRaw = Buffer.from(JSON.stringify(failed));
  const failedHeaders = { "x-razorpay-signature": signature(failedRaw, process.env.RAZORPAY_WEBHOOK_SECRET) };
  await request("POST", "/payment/webhook", failed, { rawBody: failedRaw, headers: failedHeaders });
  assert.equal(User.updateOne.mock.calls.length, 2);
});

test("membership verification reports expired memberships as free", async (t) => {
  const user = setup(t);
  Object.assign(user, { isPremium: true, membershipType: "silver", membershipValidUntil: new Date(0) });
  const result = await request("GET", "/payment/verify");
  assert.equal(result.data.isPremium, false);
  assert.equal(result.data.user.isPremium, false);
  assert.equal(result.data.usage.limit, 10);
});

test("invalid plans are rejected before calling Razorpay", async (t) => {
  setup(t);
  t.mock.method(razorpay.orders, "create", async () => { throw new Error("Should not be called"); });
  for (const membershipType of ["bad", "__proto__", "toString"]) {
    assert.equal((await request("POST", "/payment/create", { membershipType })).status, 400);
  }
  assert.equal(razorpay.orders.create.mock.calls.length, 0);
});
