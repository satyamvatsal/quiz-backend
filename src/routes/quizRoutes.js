const express = require("express");
const db = require("../config/db");
const verifyAdminKey = require("../middleware/verifyAdminKey");

const router = express.Router();

router.get("/questions", verifyAdminKey, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM questions");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/questions", verifyAdminKey, async (req, res) => {
  const { question, options, correctAnswer, hint } = req.body;

  if (!question || !options || !correctAnswer) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    await db.query(
      "INSERT INTO questions (question_text, options, correct_answer ,hint) VALUES ($1, $2, $3, $4)",
      [question, JSON.stringify(options), correctAnswer, hint],
    );

    res.status(201).json({ message: "Question added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
module.exports = router;
