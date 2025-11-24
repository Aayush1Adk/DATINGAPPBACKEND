// ================= IMPORTS =================
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import UsersAuth from "../models/UsersAuth.js";

// ================= HELPER =================
function isValidLocalPhone(phone) {
  return /^(97|98)\d{8}$/.test(phone?.toString().trim());
}

// ================= SEND OTP =================
export const sendOTP = async (req, res) => {
  const { email, phone, password, confirmPassword } = req.body;

  if (!email || !phone || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  if (!isValidLocalPhone(phone)) {
    return res.status(400).json({ success: false, message: "Invalid phone number" });
  }

  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({ success: false, message: "Passwords do not match" });
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  try {
    let user = await UsersAuth.findOne({ $or: [{ email }, { phone }] });

    const hashedPassword = await bcrypt.hash(password, 10);

    if (!user) {
      // Create new user
      user = new UsersAuth({
        email,
        phone,
        password: hashedPassword,
        otp,
        otpExpiresAt: Date.now() + 2 * 60 * 1000,
        verified: false,
      });
    } else {
      // Update existing unverified user
      user.password = hashedPassword;
      user.otp = otp;
      user.otpExpiresAt = Date.now() + 2 * 60 * 1000;
      user.verified = false;
    }

    await user.save();

    // Send OTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Yugma OTP",
      text: `Your OTP is ${otp}. Valid for 2 minutes.`,
    });

    res.json({ success: true, message: "OTP sent successfully" });

  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

// ================= VERIFY OTP =================
export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP required" });
  }

  try {
    const user = await UsersAuth.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.otp || Date.now() > user.otpExpiresAt) {
      user.otp = null;
      user.otpExpiresAt = null;
      await user.save();
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    if (user.otp !== otp.toString().trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Mark user as verified
    user.verified = true;
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
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
    console.error("Error verifying OTP:", err);
    res.status(500).json({ success: false, message: "Failed to verify OTP" });
  }
};

// ================= LOGIN =================
export const loginUser = async (req, res) => {
  const { email, phone, password } = req.body;

  if ((!email && !phone) || !password) {
    return res.status(400).json({ success: false, message: "Email/Phone and password required" });
  }

  try {
    const user = email
      ? await UsersAuth.findOne({ email })
      : await UsersAuth.findOne({ phone });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!user.verified) return res.status(400).json({ success: false, message: "Verify your account first" });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
      return res.status(400).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
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
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
