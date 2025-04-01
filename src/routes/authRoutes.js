const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
require("dotenv").config();

const router = express.Router();

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  console.log(req.body);
  const existingUser = await db.query(
    "SELECT * FROM users WHERE username = $1 OR email = $2",
    [username, email],
  );
  if (existingUser.rows.length > 0) {
    return res.status(400).json({ message: "Username or email already taken" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await db.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)  RETURNING id, username",
      [username, email, hashedPassword],
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      {
        expiresIn: "12h",
      },
    );
    res.json({ token, message: "User registered" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      {
        expiresIn: "12h",
      },
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
