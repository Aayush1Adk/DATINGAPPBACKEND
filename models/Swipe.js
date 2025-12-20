import mongoose from "mongoose";

const SwipeSchema = new mongoose.Schema({
  swiperId: { type: mongoose.Schema.Types.ObjectId, ref: "UsersAuth", required: true, index: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: "UsersAuth", required: true, index: true },
  action: { type: String, enum: ['like','dislike','superlike'], required: true },
  createdAt: { type: Date, default: Date.now }
});




export default mongoose.model("Swipe", SwipeSchema, "Swipe");
