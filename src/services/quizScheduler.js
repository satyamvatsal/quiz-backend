const { redisPublisher, redisClient } = require("../config/redis");
const moment = require("moment");
const db = require("../config/db");
require("dotenv").config();

const QUESTION_INTERVAL = process.env.QUESTION_INTERVAL * 1000;

let questions = [];
let currentIndex = 0;
let questionInterval;

const loadQuestions = async () => {
  try {
    const result = await db.query("SELECT * FROM questions ORDER BY id ASC");
    questions = result.rows;
    currentIndex = 0;
    console.log(`✅ Loaded ${questions.length} questions into memory.`);
  } catch (err) {
    console.error("❌ Error loading questions:", err);
  }
};

const sendNextQuestion = async () => {
  if (questions.length === 0) {
    console.log("⚠️ No questions available. Reloading...");
    await loadQuestions();
    return;
  }
  if (currentIndex >= questions.length) {
    const message = "The quiz has ended. Thank you for participation";
    const quizEndTime = Date.now();
    const data = JSON.stringify({ message, quizEndTime, quizEnded: true });
    await redisClient.del("latest_question");
    await redisPublisher.publish("quiz_info", data);
    clearInterval(questionInterval);
    return;
  }
  const questionData = questions[currentIndex];
  const message = JSON.stringify({
    id: questionData.id,
    question_text: questionData.question_text,
    options: questionData.options,
    correct_answer: questionData.correct_answer,
  });

  await redisPublisher.publish("quiz_channel", message);
  console.log(`✅ Sent question: ${questionData.question_text}`);

  currentIndex = currentIndex + 1;
};

const startQuestionScheduler = async () => {
  console.log("🔄 Starting question scheduler...");
  await loadQuestions();
  await sendNextQuestion();
  if (questionInterval) clearInterval(questionInterval);
  questionInterval = setInterval(sendNextQuestion, QUESTION_INTERVAL);
};

const scheduledQuizStart = async () => {
  const quizStartTimeMoment = moment(process.env.QUIZ_START_TIME);
  const quizStartTime = moment(quizStartTimeMoment).valueOf();
  const message = "The quiz will be started soon.";
  const quizEnded = false;
  await redisPublisher.publish(
    "quiz_info",
    JSON.stringify({
      message,
      quizStartTime,
      quizEnded,
    }),
  );
  console.log("quiz info published ", quizStartTime);
  const currentTime = moment();
  const delay = quizStartTimeMoment.diff(currentTime);
  if (delay > 0) {
    console.log(`⏳ Quiz will start in ${delay / 1000} seconds...`);
    setTimeout(startQuestionScheduler, delay);
  } else {
    console.log("🚨 Scheduled time is in the past! Starting immediately...");
    startQuestionScheduler();
  }
};

module.exports = { scheduledQuizStart };
