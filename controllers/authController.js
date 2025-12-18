import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import UsersAuth from "../models/UsersAuth.js";

/* -------------------- HELPERS -------------------- */

const log = (...args) => console.log("🔐 AUTH:", ...args);

const sendError = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message,
  });
};

const isValidLocalPhone = (phone) => {
  if (!phone) return false;
  return /^(97|98)\d{8}$/.test(phone.toString().trim());
};

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/* -------------------- SEND OTP (REGISTER) -------------------- */

export const sendOTP = async (req, res) => {
  try {
    log("SEND OTP HIT");
    log("Request body:", req.body);

    const { email, phone, password, confirmPassword } = req.body;

    if (!email || !phone || !password) {
      return sendError(res, 400, "Email, phone and password are required");
    }

    if (!isValidLocalPhone(phone)) {
      return sendError(res, 400, "Invalid Nepali phone number");
    }

    if (confirmPassword && password !== confirmPassword) {
      return sendError(res, 400, "Passwords do not match");
    }

    let user = await UsersAuth.findOne({
      $or: [{ email }, { phone }],
    });

    if (user && user.verified) {
      return sendError(res, 409, "User already exists and is verified");
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiresAt = Date.now() + 2 * 60 * 1000;

    if (!user) {
      user = new UsersAuth({
        email,
        phone,
        password, // hashed by schema
        otp,
        otpExpiresAt,
        verified: false,
      });
    } else {
      user.email = email;
      user.phone = phone;
      user.password = password; // rehash
      user.otp = otp;
      user.otpExpiresAt = otpExpiresAt;
      user.verified = false;
    }

    await user.save();
    log("User saved:", user._id.toString());
    log("OTP generated:", otp);

    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}. Valid for 2 minutes.`,
    });

    log("OTP email sent to:", email);

    return res.json({
      success: true,
      message: "OTP sent to email",
    });
  } catch (err) {
    console.error("❌ sendOTP error:", err);
    return sendError(res, 500, "Failed to send OTP");
  }
};

/* -------------------- VERIFY OTP -------------------- */

export const verifyOTP = async (req, res) => {
  try {
    log("VERIFY OTP HIT");
    log("Request body:", req.body);

    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendError(res, 400, "Email and OTP are required");
    }

    const user = await UsersAuth.findOne({ email });
    if (!user) return sendError(res, 404, "User not found");

    if (!user.otp || !user.otpExpiresAt) {
      return sendError(res, 400, "OTP not requested");
    }

    if (Date.now() > new Date(user.otpExpiresAt).getTime()) {
      user.otp = null;
      user.otpExpiresAt = null;
      await user.save();
      return sendError(res, 400, "OTP expired");
    }

    if (user.otp !== otp.toString().trim()) {
      return sendError(res, 400, "Invalid OTP");
    }

    user.verified = true;
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    log("OTP verified for:", user._id.toString());

    return res.json({
      success: true,
      message: "OTP verified",
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("❌ verifyOTP error:", err);
    return sendError(res, 500, "OTP verification failed");
  }
};

/* -------------------- LOGIN -------------------- */

export const loginUser = async (req, res) => {
  try {
    log("LOGIN HIT");
    log("Request body:", req.body);

    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return sendError(res, 400, "Email/phone and password required");
    }

    const user = await UsersAuth.findOne(
      email ? { email } : { phone }
    );

    if (!user) return sendError(res, 404, "User not found");
    if (!user.verified) return sendError(res, 403, "Account not verified");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return sendError(res, 401, "Invalid credentials");

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    log("Login success:", user._id.toString());

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("❌ loginUser error:", err);
    return sendError(res, 500, "Login failed");
  }
};
