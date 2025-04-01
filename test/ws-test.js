import { check, sleep } from "k6";
import ws from "k6/ws";

export let options = {
  stages: [
    { duration: "10s", target: 50 }, // Ramp-up
    { duration: "30s", target: 100 }, // Hold
    { duration: "10s", target: 0 }, // Ramp-down
  ],
};

export default function () {
  const authToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE2LCJ1c2VybmFtZSI6InNhdHlhbSIsImlhdCI6MTc0MzE5Mjg2NywiZXhwIjoxNzQzMjM2MDY3fQ.0D4ca3a8sjm4M8OmZ0EGWI2qyr201x-gjofN3WKBtYg";
  const url = `ws://localhost:3000?token=${authToken}`;

  let res = ws.connect(url, {}, function (socket) {
    socket.on("open", function () {
      console.log("Connected");
      socket.send(JSON.stringify({ event: "join_quiz", user: `user_${__VU}` }));
    });

    socket.on("latest_question", function (msg) {
      console.log(`Received: ${msg}`);
      check(msg, { "Received message": (m) => m !== "" });
    });

    socket.on("close", function () {
      console.log("Disconnected");
    });

    sleep(2);
    socket.send(JSON.stringify({ event: "submit_answer", answer: "B" }));

    sleep(5);
  });

  check(res, { "Connection status is 101": (r) => r && r.status === 101 });
}
