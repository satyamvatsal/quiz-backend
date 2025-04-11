const socketAuth = require("../../src/middleware/socketAuth");
const { redisClient, redisSubscriber } = require("../config/redis");
const { scheduledQuizStart } = require("../../src/services/quizScheduler");
require("dotenv").config();
const {
  handleUserResponse,
  getUserScore,
  sendScoresToUsers,
  sendQuizInfo,
  sendLatestQuestion,
  sendActiveUsers,
  sendRanks,
  sendLeaderboard,
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
      const data = JSON.parse(message);
      await redisClient.set("quiz_info", message);
      await sendQuizInfo(io, data);
    }
    if (channel === "quiz_channel") {
      const questionData = JSON.parse(message);
      const { id, question_text, options, correct_answer } = questionData;
      await redisClient.hset("correct_answer", id, correct_answer);
      console.log("quiz channel socket");
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
      await sendLatestQuestion(io);
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
    redisClient.hset("socket_to_user", socket.id, userId);
    redisClient.hset("user_to_socket", userId, socket.id);
    redisClient.hset("socket_to_username", socket.id, socket.user.username);
    sendLatestQuestion(socket);
    const message = await redisClient.get("quiz_info");
    const messageObject = JSON.parse(message);
    if (messageObject?.quizEnded || socket.user.username === "admin") {
      sendLeaderboard(socket);
    }
    sendActiveUsers(io);
    sendQuizInfo(socket, messageObject);
    const socketRank = await redisClient.hget("user_rank", socket.user.userId);
    socket.emit("user_rank", socketRank);

    socket.on("submit_answer", async ({ questionId, answer }) => {
      try {
        const currentTime = Date.now();
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

        const responseTime = (currentTime - startTime) / 1000;
        if (Math.ceil(responseTime) > ANSWER_DEADLINE) {
          socket.emit("error", {
            message: "Time exceeded. Answer not recorded.",
          });
          return;
        }

        const hasSubmitted = await redisClient.sismember(
          `answered_users:${questionId}`,
          userId,
        );
        if (hasSubmitted) {
          socket.emit("error", {
            message: "You have already submitted an answer for this question.",
          });
          console.log(`${socket.user.username} has submitted again`);
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

    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.id} ${socket.user?.username}`);
      redisClient.hdel("socket_to_user", socket.id);
      redisClient.hdel("socket_to_username", socket.id);
      if (socket.user.userId)
        redisClient.hdel("user_to_socket", socket.user.userId);
      sendActiveUsers(io);
    });

    socket.on("getLeaderboard", async () => {
      if (messageObject?.quizEnded || socket.user.username === "admin") {
        await sendLeaderboard(socket);
      }
    });
  });
};
