const Redis = require("ioredis");
require("dotenv").config();

const redisClient = new Redis(process.env.REDIS_URL);
const redisSubscriber = new Redis(process.env.REDIS_URL);
const redisPublisher = new Redis(process.env.REDIS_URL);

redisClient.on("connect", async () => {
  await redisClient.flushall();
  console.log("✅ Redis Client Connected");
});
redisSubscriber.on("connect", async () =>
  console.log("✅ Redis Subscriber Connected"),
);
redisPublisher.on("connect", () => console.log("✅ Redis Publisher Connected"));

redisClient.on("error", (error) =>
  console.log("❌ Redis Client Error:", error),
);
redisSubscriber.on("error", (error) =>
  console.log("❌ Redis Subscriber Error:", error),
);
redisPublisher.on("error", (error) =>
  console.log("❌ Redis Publisher Error:", error),
);

module.exports = { redisClient, redisPublisher, redisSubscriber };
