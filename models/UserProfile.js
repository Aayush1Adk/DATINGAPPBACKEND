import mongoose from "mongoose";

const UserProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "UsersAuth", required: true, unique: true },
  firstName: { type: String, default: null },
  secondName: { type: String, default: null },
  lastName: { type: String, default: null },
  dateOfBirth: { type: Date, default: null },
  gender: {
    type: String,
    enum: ['male', 'female', 'gay', 'lesbian', 'bisexual', 'trans', null],
    default: null
  },
  bio: { type: String, maxlength: 250, default: null },
  gotra: { type: String, default: null },
  profession: { type: String, default: null },
  education: { type: String, default: null },
  address: { type: String, default: null },
  height: { type: Number, min: 100, max: 250, default: null },
  profileComplete: { type: Boolean, default: false },
  profileStep: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserProfileSchema.pre("save", function(next){
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("UserProfile", UserProfileSchema, "UserProfile");
