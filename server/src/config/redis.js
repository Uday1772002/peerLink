const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  socket: {
    reconnectStrategy: () => false,
  },
});

redisClient.isRedisEnabled = false;

redisClient.on("connect", () => {
  redisClient.isRedisEnabled = true;
});

redisClient.on("ready", () => {
  redisClient.isRedisEnabled = true;
});

redisClient.on("end", () => {
  redisClient.isRedisEnabled = false;
});

redisClient.on("error", (err) => {
  redisClient.isRedisEnabled = false;
  console.warn(
    "Redis unavailable; continuing without Redis cache:",
    err.message,
  );
});

async function initRedis() {
  if (redisClient.isRedisEnabled) {
    return redisClient;
  }

  try {
    await redisClient.connect();
    redisClient.isRedisEnabled = true;
    console.log("Redis connected successfully");
    return redisClient;
  } catch (error) {
    redisClient.isRedisEnabled = false;
    console.warn(
      "Redis is not available; continuing without Redis:",
      error.message,
    );
    return redisClient;
  }
}

const redisExports = {
  redisClient,
  initRedis,
};

Object.defineProperty(redisExports, "isRedisAvailable", {
  get: () => redisClient.isRedisEnabled,
  enumerable: true,
});

module.exports = redisExports;
