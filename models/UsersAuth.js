import mongoose from "mongoose";

const UsersAuthSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true }, // hashed
  otp: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}); 

UsersAuthSchema.pre("save", function(next){
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("UsersAuth", UsersAuthSchema, "UsersAuth");
