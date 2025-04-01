require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const initWebSocket = require("./src/ws/socket");

const authRoutes = require("./src/routes/authRoutes");
const quizRoutes = require("./src/routes/quizRoutes");

const { scheduledQuizStart } = require("./src/services/quizScheduler");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/quiz", quizRoutes);

scheduledQuizStart();
initWebSocket(io);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
