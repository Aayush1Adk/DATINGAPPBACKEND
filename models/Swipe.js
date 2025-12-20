import mongoose from "mongoose";

const SwipeSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "UsersAuth", 
    required: true, 
    index: true 
  },
  targetUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "UsersAuth", 
    required: true, 
    index: true 
  },
  action: { 
    type: String, 
    enum: ['like', 'dislike', 'superlike'], 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound index to prevent duplicate swipes
SwipeSchema.index({ userId: 1, targetUserId: 1 }, { unique: true });

export default mongoose.model("Swipe", SwipeSchema, "Swipe");