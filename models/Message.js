import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
      index: true
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UsersAuth",
      required: true,
      index: true
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UsersAuth",
      required: true,
      index: true
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },

    messageType: {
      type: String,
      enum: ["text"],
      default: "text"
    },

    seen: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);


MessageSchema.index({ matchId: 1, createdAt: -1 });
export default mongoose.model("Message", MessageSchema, "Message");
