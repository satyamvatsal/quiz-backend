const moment = require("moment");
const { redisClient, redisSubscriber } = require("../config/redis");
require("dotenv").config();

const ANSWER_DEADLINE = parseInt(process.env.ANSWER_DEADLINE);
const MAX_SCORE = parseInt(process.env.MAX_SCORE);
const MIN_SCORE = parseInt(process.env.MIN_SCORE);
const INCORRECT_PENALTY = parseInt(process.env.INCORRECT_PENALTY);
const SCORE_SHARPNESS = parseInt(process.env.ANSWER_DEADLINE) / 100;

const handleUserResponse = async (
  userId,
  questionId,
  selectedAnswer,
  responseTime,
) => {
  const correctAnswer = await redisClient.hget("correct_answer", questionId);
  const isCorrect = correctAnswer === selectedAnswer;
  const responseData = JSON.stringify({
    userId,
    questionId,
    selectedAnswer,
    responseTime,
    isCorrect,
  });
  redisClient.rpush("responses_queue", responseData);
  if (isCorrect) {
    const timeLeft = ANSWER_DEADLINE - responseTime;
    const scoreIncrement = Math.max(
      MIN_SCORE,
      Math.round(MAX_SCORE * (timeLeft / ANSWER_DEADLINE)),
    );
    console.log(scoreIncrement);
    await redisClient.hincrby("user_scores", userId, scoreIncrement);
  } else {
    const scoreDecrement = INCORRECT_PENALTY;
    await redisClient.hincrby("user_scores", userId, -scoreDecrement);
  }
};

const sendScoresToUsers = async (io) => {
  const userSocketMap = await redisClient.hgetall("user_to_socket");
  const usernameSocketMap = await redisClient.hgetall("socket_to_username");

  let allScores = [];
  for (const [userId, socketId] of Object.entries(userSocketMap)) {
    const score = (await redisClient.hget("user_scores", userId)) || 0;
    io.to(socketId).emit("update_score", { score });

    const username = usernameSocketMap[socketId] || "unknown";
    if (username !== "admin") allScores.push({ userId, username, score });
    console.log(
      `📩 Sent score ${score} to user ${userId} (socket: ${socketId})`,
    );
  }

  allScores.sort((a, b) => b.score - a.score);
  io.to("leaderboard").emit("update_leaderboard", { scores: allScores });
};

const sendQuizInfo = async (socket, message) => {
  socket.emit("quiz_info", message);
};

const sendLatestQuestion = async (socket) => {
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
};

module.exports = {
  handleUserResponse,
  sendScoresToUsers,
  sendQuizInfo,
  sendLatestQuestion,
};
