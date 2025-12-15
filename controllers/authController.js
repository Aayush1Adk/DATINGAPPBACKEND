// controllers/authController.js
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs"; // used only for compare, not hashing before save
import jwt from "jsonwebtoken";
import UsersAuth from "../models/UsersAuth.js";

// Helper: simple Nepal local phone validator (97/98)
function isValidLocalPhone(phone) {
  if (!phone) return false;
  const s = phone.toString().trim();
  return /^(97|98)\d{8}$/.test(s);
}

// Standard response helper
function sendError(res, status = 400, message = "Invalid request") {
  return res.status(status).json({ success: false, message });
}

// Create transporter once (will read from env)
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ================= REGISTER / SEND OTP (email) =================
export const sendOTP = async (req, res) => {
  try {
    const { email, phone, password, confirmPassword } = req.body;

    if (!email || !phone || !password) {
      return sendError(res, 400, "Email, phone and password are required");
    }

    // basic validations
    if (!isValidLocalPhone(phone)) {
      return sendError(res, 400, "Invalid local phone number");
    }

    if (confirmPassword && password !== confirmPassword) {
      return sendError(res, 400, "Passwords do not match");
    }

    // check if user exists
    let existing = await UsersAuth.findOne({ $or: [{ email }, { phone }] });

    // If already exists and verified -> cannot register
    if (existing && existing.verified) {
      return sendError(res, 409, "An account with this email/phone already exists");
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes

    // If user exists (but not verified) update fields, otherwise create new doc.
    let user;
    if (!existing) {
      user = new UsersAuth({
        email,
        phone,
        password, // NOTE: UsersAuth schema pre-save will hash this
        otp,
        otpExpiresAt,
        verified: false,
      });
    } else {
      // update existing unverified user
      existing.email = email;
      existing.phone = phone;
      existing.password = password; // UsersAuth pre-save will hash
      existing.otp = otp;
      existing.otpExpiresAt = otpExpiresAt;
      existing.verified = false;
      user = existing;
    }

    await user.save();

    // send OTP to email only
    const transporter = createTransporter();

    // Optionally verify transporter once (silent) — don't throw to client if transporter can't verify
    transporter.verify().catch((err) => {
      console.error("Nodemailer verify failed:", err && err.message);
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Yugma OTP",
      text: `Your OTP is ${otp}. It is valid for 2 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error("sendOTP error:", err);
    return sendError(res, 500, "Failed to send OTP");
  }
};

// ================= VERIFY OTP =================
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return sendError(res, 400, "Email and OTP are required");

    const user = await UsersAuth.findOne({ email });
    if (!user) return sendError(res, 404, "User not found");

    // Check expiry
    if (!user.otp || !user.otpExpiresAt || Date.now() > new Date(user.otpExpiresAt).getTime()) {
      user.otp = null;
      user.otpExpiresAt = null;
      await user.save().catch(() => {});
      return sendError(res, 400, "OTP expired");
    }

    if (user.otp !== otp.toString().trim()) {
      return sendError(res, 400, "Invalid OTP");
    }

    // Mark verified and clear OTP
    user.verified = true;
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    // issue JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      success: true,
      message: "OTP verified",
      token,
      user: { id: user._id, email: user.email, phone: user.phone },
    });
  } catch (err) {
    console.error("verifyOTP error:", err);
    return sendError(res, 500, "Failed to verify OTP");
  }
};

// ================= LOGIN =================
export const loginUser = async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    if ((!email && !phone) || !password) {
      return sendError(res, 400, "Email/Phone and password are required");
    }

    const query = email ? { email } : { phone };
    const user = await UsersAuth.findOne(query);

    if (!user) return sendError(res, 404, "User not found");
    if (!user.verified) return sendError(res, 403, "Please verify your account first");

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return sendError(res, 401, "Invalid credentials");

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user._id, email: user.email, phone: user.phone },
    });
  } catch (err) {
    console.error("loginUser error:", err);
    return sendError(res, 500, "Server error");
  }
};
