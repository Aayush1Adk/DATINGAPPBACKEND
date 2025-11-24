import express from "express";
import { sendOTP, verifyOTP, loginUser } from "../controllers/authController.js";

const router = express.Router();

// Routes
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.post("/login", loginUser);

export default router;
