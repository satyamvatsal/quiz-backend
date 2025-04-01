const verifyAdminKey = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"];

  if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ message: "Invalid admin key" });
  }

  next();
};
module.exports = verifyAdminKey;
