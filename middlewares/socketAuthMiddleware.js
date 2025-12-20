import jwt from "jsonwebtoken";
import UsersAuth from "../models/UsersAuth.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    // 1. Get token from handshake auth
    const token = socket.handshake.auth?.token;

    if (!token) {
      const err = new Error("Authentication error: Token missing");
      err.data = { content: "Token is required" };
      return next(err);
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Find user in DB
    const user = await UsersAuth.findById(decoded.id);

    if (!user || !user.verified) {
      const err = new Error("Authentication error: Invalid or unverified user");
      err.data = { content: "Invalid user" };
      return next(err);
    }

    // 4. Attach user info to socket object
    socket.user = {
      id: user._id.toString(),
      email: user.email
    };

    // 5. Allow connection
    next();
  } catch (error) {
    console.error("Socket auth error:", error.message);
    const err = new Error("Authentication error");
    err.data = { content: error.message };
    next(err);
  }
};