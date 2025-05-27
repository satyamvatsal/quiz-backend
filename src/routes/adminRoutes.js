const express = require("express");
const router = express.Router();
require("dotenv").config();
const { scheduledQuizStart } = require("../services/quizScheduler");
const authMiddleware = require("../middleware/authMiddleware");
const { redisClient } = require("../config/redis");

let count = 0;

router.post("/start", authMiddleware, async (req, res) => {
  try {
    // if (req.user.username !== "admin") {
    //   return res.status(401).json({ message: "UnAuthorized" });
    // }
    await redisClient.flushall();
    if (count % 2) await scheduledQuizStart();
    count++;
    res.status(200).json({ message: "quiz started." });
  } catch (err) {
    console.log("admin start error: ", err);
    res.status(500).json({ message: "failed to start quiz" });
  }
});
module.exports = router;
