const User = require("../models/user");
const { membershipAmount, dailyLimit } = require("./constants");

const isPremiumUser = (user) => {
  return Boolean(
    user?.isPremium &&
    ["silver", "gold", "platinum", "premium"].includes(user.membershipType) &&
    user.membershipValidUntil &&
    new Date(user.membershipValidUntil) > new Date(),
  );
};

const getMembershipExpiry = (type, startDate) => {
  const months = membershipAmount[type]?.months;
  if (!months) throw new Error("Invalid membership type");
  const date = new Date(startDate);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
};

const getDailyUsage = (user) => {
  const date = new Date().toISOString().slice(0, 10);
  return {
    date,
    messages: user.dailyUsage?.date === date ? user.dailyUsage.messages || 0 : 0,
    swipes: user.dailyUsage?.date === date ? user.dailyUsage.swipes || 0 : 0,
    limit: isPremiumUser(user) ? null : dailyLimit,
  };
};

const reserveDailyUsage = async (user, type) => {
  if (isPremiumUser(user)) return null;
  const date = new Date().toISOString().slice(0, 10);
  // Reset only once per day, then reserve atomically across tabs and sockets.
  await User.updateOne(
    { _id: user._id, "dailyUsage.date": { $ne: date } },
    { $set: { dailyUsage: { date, messages: 0, swipes: 0 } } },
  );
  const updatedUser = await User.findOneAndUpdate(
    { _id: user._id, "dailyUsage.date": date, ["dailyUsage." + type]: { $lt: dailyLimit } },
    { $inc: { ["dailyUsage." + type]: 1 } },
    { new: true },
  );
  if (!updatedUser) {
    const error = new Error("You have reached your daily " + type + " limit. Upgrade to premium for unlimited " + type + ".");
    error.code = "DAILY_LIMIT";
    throw error;
  }
  return date;
};

const releaseDailyUsage = async (userId, type, date) => {
  if (!date) return;
  await User.updateOne(
    { _id: userId, "dailyUsage.date": date, ["dailyUsage." + type]: { $gt: 0 } },
    { $inc: { ["dailyUsage." + type]: -1 } },
  );
};

module.exports = { isPremiumUser, getMembershipExpiry, getDailyUsage, reserveDailyUsage, releaseDailyUsage };
