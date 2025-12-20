import mongoose from "mongoose";

const MatchSchema = new mongoose.Schema({
  userA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UsersAuth",
    required: true,
    index: true
  },
  userB: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UsersAuth",
    required: true,
    index: true
  },

  isActive: {
    type: Boolean,
    default: true
  },

  matchedAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate matches (A-B and B-A problem handled in logic)
MatchSchema.index({ userA: 1, userB: 1 }, { unique: true });

export default mongoose.model("Match", MatchSchema, "Match");
