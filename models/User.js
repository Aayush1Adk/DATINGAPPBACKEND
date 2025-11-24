import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  // ========== AUTH FIELDS ==========
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  otp: { type: String },
  otpExpiresAt: { type: Date },
  verified: { type: Boolean, default: false },
  
  // ========== BASIC PROFILE (Step 1) ==========
  firstName: { type: String, default: null },
  secondName: { type: String, default: null },
  lastName: { type: String, default: null },
  dateOfBirth: { type: Date, default: null },
  
  // ========== GENDER & PREFERENCE (Step 2) ==========
  gender: { 
    type: String, 
    enum: ['male', 'female', 'gay', 'lesbian', 'bisexual', 'trans', null],
    default: null 
  },
  
  // ========== DETAILED PROFILE (Step 3) ==========
  photos: [{
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  bio: { 
    type: String, 
    maxlength: 250,
    default: null 
  },
  gotra: { type: String, default: null },
  profession: { type: String, default: null },
  education: { type: String, default: null },
  address: { type: String, default: null },
  height: { 
    type: Number,
    min: 100,
    max: 250,
    default: null 
  },
  interests: {
    type: [String],
    default: [],
    validate: [interestsLimit, 'Interests cannot exceed 6']
  },
  datePreference: {
    type: [String],
    enum: ['man', 'woman', 'gay', 'lesbian', 'bisexual', 'trans'],
    default: []
  },
  
  // ========== PROFILE STATUS ==========
  profileComplete: { type: Boolean, default: false },
  profileStep: { type: Number, default: 1 },
  
  // ========== TIMESTAMPS ==========
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

function interestsLimit(val) {
  return val.length <= 6;
}

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.model("User", userSchema, "Usersinfo");

export default User;