const jwt = require("jsonwebtoken");

const socketAuth = (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    socket.disconnect(true);
    return next(new Error("Unauthorized: Token missing"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    socket.disconnect(true);
    return;
  }
};

module.exports = socketAuth;
