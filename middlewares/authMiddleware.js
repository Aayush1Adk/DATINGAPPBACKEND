// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import UsersAuth from "../models/UsersAuth.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    // Expect: Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Token missing."
      });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and remove password
    const user = await UsersAuth.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User not found."
      });
    }

    // Additional: block unverified accounts
    if (!user.verified) {
      return res.status(403).json({
        success: false,
        message: "Account not verified."
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);

    return res.status(401).json({
      success: false,
      message: "Unauthorized. Invalid or expired token."
    });
  }
};
