import mongoose from "mongoose";
import bcrypt from "bcrypt";
import UserProfile from "./UserProfile.js";
import UserPreferences from "./UserPreferences.js";
import UserPhoto from "./UserPhoto.js";
import Location from "./Location.js";
import cloudinary from "../config/cloudinary.js";

const UsersAuthSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true // hashed
  },
  otp: {
    type: String,
    default: null
  },
  otpExpiresAt: {
    type: Date,
    default: null
  },
  verified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Hash password before save
 */
UsersAuthSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }
  this.updatedAt = Date.now();
  next();
});

/**
 * Cascade delete related user data
 * IMPORTANT: triggers ONLY on findOneAndDelete / findByIdAndDelete
 */
UsersAuthSchema.pre("findOneAndDelete", async function (next) {
  const user = await this.model.findOne(this.getFilter());
  if (!user) return next();

  const userId = user._id;

  try {
    // Delete Cloudinary images
    const photos = await UserPhoto.find({ userId });
    for (const p of photos) {
      if (p.publicId) {
        cloudinary.uploader.destroy(p.publicId).catch(() => {});
      }
    }

    // Delete DB records
    await Promise.all([
      UserProfile.deleteOne({ userId }),
      UserPreferences.deleteOne({ userId }),
      UserPhoto.deleteMany({ userId }),
      Location.deleteOne({ userId })
    ]);

    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model("UsersAuth", UsersAuthSchema, "UsersAuth");
