const test = require("node:test");
const assert = require("node:assert/strict");

const redisConfig = require("../src/config/redis");
const { initRedis, redisClient } = redisConfig;

test("initRedis should not throw when Redis is unavailable", async () => {
  await assert.doesNotReject(() => initRedis());
  assert.equal(typeof redisConfig.isRedisAvailable, "boolean");
  assert.equal(redisClient.isRedisEnabled, false);
});
