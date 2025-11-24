import mongoose from "mongoose";

const UserPhotoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "UsersAuth", required: true, index: true },
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  order: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now }
});

export default mongoose.model("UserPhoto", UserPhotoSchema, "UserPhoto");
