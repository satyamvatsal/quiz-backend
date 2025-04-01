const socketAuth = require("../../src/middleware/socketAuth");
const { redisClient, redisSubscriber } = require("../config/redis");
const db = require("../config/db");
require("dotenv").config();

const ANSWER_DEADLINE = parseInt(process.env.ANSWER_DEADLINE);

module.exports = (io) => {
  io.use(socketAuth);

  redisSubscriber.subscribe("quiz_channel", (err, count) => {
    if (err) {
      console.error("❌ redisClient subscription failed:", err);
    } else {
      console.log(`✅ Subscribed to ${count} channel(s): quiz_channel`);
    }
  });

  redisSubscriber.on("message", async (channel, message) => {
    if (channel === "quiz_info") {
      const broadcastQuizEnd = () => {
        io.emit("quiz_info", message);
      };
      setInterval(broadcastQuizEnd, 1000);
    }
    if (channel === "quiz_channel") {
      console.log(`📩 Message received on ${channel}:`, message);
      const questionData = JSON.parse(message);
      const { id, question_text, options, correct_answer } = questionData;
      console.log("Correct answer: ", correct_answer);
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
      console.log("Question sent to all users: ", {
        id,
        question_text,
        options,
        startTime,
      });

      setTimeout(() => {
        io.emit("time_up", { message: "Time is up! Processing answers..." });
        io.emit("correct_answer", correct_answer);
      }, ANSWER_DEADLINE * 1000);
    }
  });

  io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.id} ${socket.user.username}`);

    socket.on("submit_answer", async ({ questionId, answer }) => {
      try {
        if (!socket.user) {
          socket.emit("error", { message: "Unauthorized" });
          return;
        }

        const userId = socket.user.userId;
        console.log(socket.user);
        console.log(`${userId} responded ${answer}`);
        const submittedAt = new Date();
        const startTime = await redisClient.get(
          `question_start_time:${questionId}`,
        );

        if (!startTime) {
          socket.emit("error", { message: "Question not found or expired." });
          return;
        }

        const responseTime = (Date.now() - startTime) / 1000;
        if (Math.ceil(responseTime) > ANSWER_DEADLINE) {
          console.log("time up");
          socket.emit("error", {
            message: "Time exceeded. Answer not recorded.",
          });
          return;
        }

        await db.query(
          "Insert into responses (user_id, question_id, selected_answer, response_time) values ($1, $2, $3, $4)",
          [userId, questionId, answer, responseTime],
        );
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
        console.log("sent latest question ", latestQuestion);
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

    socket.on("disconnect", () =>
      console.log(`User disconnected: ${socket.id} ${socket.user.username}`),
    );
  });
};
