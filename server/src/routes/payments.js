const express = require("express");
const paymentRouter = express.Router();
const userAuth = require("../middlewares/auth");
const RazorpayInstance = require("../utils/razorpay");
const paymentModel = require("../models/payments");
const User = require("../models/user");
const { membershipAmount } = require("../utils/constants");
const { isPremiumUser, getMembershipExpiry, getDailyUsage } = require("../utils/membership");
const { validateWebhookSignature, validatePaymentVerification } = require("razorpay/dist/utils/razorpay-utils");

const activateMembership = async (payment, paymentDetails) => {
  if (
    paymentDetails.status !== "captured" ||
    paymentDetails.order_id !== payment.orderId ||
    paymentDetails.amount !== payment.amount ||
    paymentDetails.currency !== payment.currency
  ) {
    throw new Error("Payment has not been captured or does not match the order");
  }
  // A fixed expiry makes checkout and repeated webhooks safe to process again.
  const validUntil = getMembershipExpiry(payment.notes.membershipType, payment.createdAt);
  await paymentModel.updateOne(
    { _id: payment._id },
    { $set: { status: "captured", paymentId: paymentDetails.id, membershipValidUntil: validUntil } },
  );
  await User.updateOne(
    {
      _id: payment.userId,
      $or: [
        { membershipValidUntil: { $exists: false } },
        { membershipValidUntil: null },
        { membershipValidUntil: { $lt: validUntil } },
      ],
    },
    { $set: { isPremium: true, membershipType: payment.notes.membershipType, membershipValidUntil: validUntil } },
  );
};

paymentRouter.post("/payment/create", userAuth, async (req, res) => {
  try {
    const { membershipType } = req.body;
    if (!Object.hasOwn(membershipAmount, membershipType)) {
      return res.status(400).json({ message: "Invalid membership type" });
    }
    if (isPremiumUser(req.user)) {
      return res.status(400).json({ message: "You already have an active membership" });
    }
    const { firstName, lastName, email } = req.user;
    const order = await RazorpayInstance.orders.create({
      amount: membershipAmount[membershipType].price * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
      notes: { firstName, lastName, email, membershipType },
    });
    const paymentDetails = new paymentModel({
      userId: req.user._id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      notes: order.notes,
    });
    const savedPayment = await paymentDetails.save();
    res.json({ ...savedPayment.toJSON(), keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ message: "Error creating payment: " + err.message });
  }
});

paymentRouter.post("/payment/verify", userAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every((value) => typeof value === "string" && value)) {
      return res.status(400).json({ message: "Payment details are missing" });
    }
    const payment = await paymentModel.findOne({ orderId: razorpay_order_id, userId: req.user._id });
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    const isValid = validatePaymentVerification(
      { order_id: payment.orderId, payment_id: razorpay_payment_id },
      razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET,
    );
    if (!isValid) return res.status(400).json({ message: "Invalid payment signature" });
    const paymentDetails = await RazorpayInstance.payments.fetch(razorpay_payment_id);
    if (paymentDetails.status === "authorized") {
      return res.status(202).json({ isPremium: false, message: "Payment is processing. Please check your membership again shortly." });
    }
    await activateMembership(payment, paymentDetails);
    const user = await User.findById(req.user._id);
    res.json({ isPremium: isPremiumUser(user), user });
  } catch (err) {
    res.status(400).json({ message: "Payment verification failed: " + err.message });
  }
});

paymentRouter.post("/payment/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature || !req.rawBody || !validateWebhookSignature(
      req.rawBody.toString(), signature, process.env.RAZORPAY_WEBHOOK_SECRET,
    )) {
      return res.status(400).send("Invalid webhook signature");
    }
    if (req.body.event !== "payment.captured") {
      return res.status(200).send("Event received");
    }
    const paymentDetails = req.body.payload?.payment?.entity;
    if (!paymentDetails) return res.status(400).send("Payment details are missing");
    const payment = await paymentModel.findOne({ orderId: paymentDetails.order_id });
    if (!payment) return res.status(404).send("Payment not found");
    await activateMembership(payment, paymentDetails);
    res.status(200).send("Webhook received successfully");
  } catch (err) {
    res.status(500).send("Error in webhook: " + err.message);
  }
});

paymentRouter.get("/payment/verify", userAuth, async (req, res) => {
  const user = req.user;
  res.json({
    isPremium: isPremiumUser(user),
    membershipType: isPremiumUser(user) ? user.membershipType : null,
    validUntil: isPremiumUser(user) ? user.membershipValidUntil : null,
    usage: getDailyUsage(user),
    user,
  });
});

module.exports = paymentRouter;
