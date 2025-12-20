    import Message from "../models/Message.js";

export const createMessage = async ({ matchId, senderId, receiverId, content }) => {
  const message = await Message.create({ matchId, senderId, receiverId, content });
  return message;
};

export const getMessagesByMatch = async (matchId, limit = 50, skip = 0) => {
  return Message.find({ matchId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

export const markMessageAsSeen = async (messageId) => {
  return Message.findByIdAndUpdate(messageId, { seen: true }, { new: true });
};
