const jwt = require("jsonwebtoken");
require("dotenv").config();

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ error: "Access denied. No Token provided" });
  }
  try {
    const decoded = jwt.verify(
      token.replace("Bearer ", ""),
      process.env.JWT_SECRET,
    );
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid Token" });
  }
};

module.exports = authMiddleware;
