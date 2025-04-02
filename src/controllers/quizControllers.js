const moment = require("moment");
const { redisClient, redisSubscriber } = require("../config/redis");
require("dotenv").config();

const ANSWER_DEADLINE = parseInt(process.env.ANSWER_DEADLINE);
const MAX_SCORE = parseInt(process.env.MAX_SCORE);
const INCORRECT_PENALTY = parseInt(process.env.INCORRECT_PENALTY);

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
  await redisClient.rpush("responses_queue", responseData);
  if (isCorrect) {
    const timeLeft = ANSWER_DEADLINE - responseTime;
    const scoreIncrement = Math.round((timeLeft / ANSWER_DEADLINE) * MAX_SCORE);
    await redisClient.hincrby("user_scores", userId, scoreIncrement);
  } else {
    const scoreDecrement = INCORRECT_PENALTY;
    await redisClient.hincrby("user_scores", userId, -scoreDecrement);
  }
};

const getUserScore = async (userId) => {
  try {
    const score = await redisClient.hget("user_scores", userId);
    return score || 0;
  } catch (err) {
    console.log("Error fetching user score: ", err);
    return 0;
  }
};

const sendScoresToUsers = async (io) => {
  const userSocketMap = await redisClient.hgetall("user_to_socket");

  for (const [userId, socketId] of Object.entries(userSocketMap)) {
    const score = (await redisClient.hget("user_scores", userId)) || 0;

    io.to(socketId).emit("update_score", { score });
    console.log(
      `📩 Sent score ${score} to user ${userId} (socket: ${socketId})`,
    );
  }
};

const sendQuizStart = async (socket) => {
  const startTime = await redisClient.get("quiz_start_time");
  const currentTime = Date.now();
  const timeLeft = Math.max(0, Math.floor((startTime - currentTime) / 1000));
  if (timeLeft > 0) {
    const msg = "The quiz has not started yet!";
    socket.emit("quiz_info", { msg, timeLeft });
  } else {
    socket.emit("quiz_info", { msg: "Quiz has started!", timeLeft: 0 });
  }
};

module.exports = {
  handleUserResponse,
  getUserScore,
  sendScoresToUsers,
  sendQuizStart,
};
