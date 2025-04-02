const socketAuth = require("../../src/middleware/socketAuth");
const { redisClient, redisSubscriber } = require("../config/redis");
const { scheduledQuizStart } = require("../../src/services/quizScheduler");
require("dotenv").config();
const {
  handleUserResponse,
  getUserScore,
  sendScoresToUsers,
  sendQuizStart,
} = require("../controllers/quizControllers");

const ANSWER_DEADLINE = parseInt(process.env.ANSWER_DEADLINE);

module.exports = (io) => {
  io.use(socketAuth);

  redisSubscriber.subscribe("quiz_channel", (err, count) => {
    if (err) {
      console.error("❌ redisClient subscription failed:", err);
    } else {
      console.log(`✅ Subscribed to ${count} channel(s): quiz_channel`);
    }
    redisSubscriber.subscribe("quiz_info", (err, count) => {
      if (err) {
        console.error("❌ redisClient subscription failed:", err);
      } else {
        console.log(`✅ Subscribed to ${count} channel(s): quiz info`);
        scheduledQuizStart();
      }
    });
  });

  redisSubscriber.on("message", async (channel, message) => {
    if (channel === "quiz_info") {
      const start_time = message;
      await redisClient.set("quiz_start_time", start_time);
      await sendQuizStart(io);
    }
    if (channel === "quiz_channel") {
      const questionData = JSON.parse(message);
      const { id, question_text, options, correct_answer } = questionData;
      await redisClient.hset("correct_answer", id, correct_answer);
      const startTime = Date.now();
      const questionToBeSent = {
        id,
        question_text,
        options,
        start_time: startTime,
      };
      await redisClient.set(
        "latest_question",
        JSON.stringify(questionToBeSent),
      );
      await redisClient.set(`question_start_time:${id}`, startTime);

      io.emit("new_question", questionToBeSent);
      console.log("Question sent to all users: ", questionToBeSent);

      setTimeout(async () => {
        io.emit("correct_answer", correct_answer);
        await sendScoresToUsers(io);
      }, ANSWER_DEADLINE * 1000);
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user.userId;
    console.log(`User connected: ${socket.id} ${socket.user.username}`);
    await redisClient.hset("socket_to_user", socket.id, userId);
    await redisClient.hset("user_to_socket", userId, socket.id);
    const userScore = await getUserScore(userId);
    socket.emit("update_score", { score: userScore });
    await sendQuizStart(socket);

    socket.on("submit_answer", async ({ questionId, answer }) => {
      try {
        if (!socket.user) {
          socket.emit("error", { message: "Unauthorized" });
          return;
        }
        const startTime = await redisClient.get(
          `question_start_time:${questionId}`,
        );

        if (!startTime) {
          socket.emit("error", { message: "Question not found or expired." });
          return;
        }

        const responseTime = (Date.now() - startTime) / 1000;
        if (Math.ceil(responseTime) > ANSWER_DEADLINE) {
          socket.emit("error", {
            message: "Time exceeded. Answer not recorded.",
          });
          return;
        }
        handleUserResponse(userId, questionId, answer, responseTime);
        socket.emit("answer_received", {
          message: "Answer recorded. Wait for results.",
          response_time: responseTime,
        });
      } catch (err) {
        console.error("Error processing answer:", err);
        socket.emit("error", { message: "Server error" });
      }
    });

    socket.on("get_latest_question", async () => {
      try {
        const latestQuestion = await redisClient.get("latest_question");
        if (latestQuestion) {
          socket.emit("new_question", JSON.parse(latestQuestion));
        } else {
          socket.emit("error", { message: "No active question." });
        }
      } catch (err) {
        console.error("Error fetching latest question:", err);
        socket.emit("error", { message: "Server error" });
      }
    });

    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.id} ${socket.user?.username}`);
      if (userId) {
        await redisClient.hdel("socket_to_user", socket.id);
        await redisClient.hdel("user_to_socket", userId);
      }
    });
  });
};
