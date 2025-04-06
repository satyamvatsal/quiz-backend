const { redisClient } = require("../config/redis.js");
const pool = require("../config/db.js");

async function processQueue() {
  console.log("Queue processing started...");

  while (true) {
    try {
      const response = await redisClient.brpop("responses_queue", 0);
      if (!response) continue;

      const responseData = JSON.parse(response[1]);

      const { userId, questionId, selectedAnswer, responseTime, isCorrect } =
        responseData;

      await pool.query(
        `INSERT INTO responses (user_id, question_id, selected_answer, response_time, is_correct)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, questionId, selectedAnswer, responseTime, isCorrect],
      );

      console.log(
        `✅ Inserted response for user ${userId}, question ${questionId}`,
      );
    } catch (error) {
      console.error("❌ Error processing queue:", error);
    }
  }
}

processQueue();
