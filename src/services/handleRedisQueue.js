const pool = require("../config/db.js");
const { redisClient } = require("../config/redis.js");

async function processQueue() {
  console.log("📢 Queue processing started...");
  try {
    while (true) {
      console.log("🟢 Waiting for item in queue...");
      try {
        const response = await redisClient.brpop("responses_queue", 0);
        console.log("🔵 Popped from queue:", response);

        if (!response) {
          console.log("⚠️ No data received, retrying...");
          continue;
        }

        const responseData = JSON.parse(response[1]);
        console.log("✅ Parsed Data:", responseData);

        await pool.query(
          `INSERT INTO responses (user_id, question_id, selected_answer, response_time, is_correct)
          VALUES ($1, $2, $3, $4, $5)`,
          [
            responseData.userId,
            responseData.questionId,
            responseData.selectedAnswer,
            responseData.responseTime,
            responseData.isCorrect,
          ],
        );

        console.log(
          `✅ Inserted response for user ${responseData.userId}, question ${responseData.questionId}`,
        );
      } catch (err) {
        console.error("❌ brpop Error:", err);
      }
    }
  } catch (error) {
    console.error("❌ Error processing queue:", error);
  }
}

module.exports = processQueue;
