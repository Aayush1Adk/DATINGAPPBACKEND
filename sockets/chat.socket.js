import { createMessage, getMessagesByMatch } from "../services/message.service.js";
import { getMatchById } from "../services/match.service.js";
import { sendMessageValidation } from "../validations/message.validation.js";

const chatSocket = (io, socket) => {

  // Join a chat room
  socket.on("joinRoom", async ({ matchId }) => {
    try {
      console.log(`🔵 joinRoom request - matchId: ${matchId}, userId: ${socket.user.id}`);

      if (!matchId) {
        return socket.emit("error", { message: "Match ID is required" });
      }

      const match = await getMatchById(matchId, socket.user.id);
      
      if (!match) {
        console.log(`❌ Unauthorized match access attempt - matchId: ${matchId}, userId: ${socket.user.id}`);
        return socket.emit("error", { message: "Unauthorized match or match not found" });
      }

      const roomName = `match_${matchId}`;
      socket.join(roomName);

      console.log(`✅ User ${socket.user.id} joined room ${roomName}`);
      socket.emit("joinedRoom", { matchId, roomName });

      // Send recent messages when joining room
      const messages = await getMessagesByMatch(matchId, 50, 0);
      socket.emit("messagesList", messages.reverse()); // Reverse to show oldest first

    } catch (err) {
      console.error("❌ joinRoom error:", err.message);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // Send a message
  socket.on("sendMessage", async (data) => {
    try {
      console.log(`📨 sendMessage request - userId: ${socket.user.id}`, data);

      const { error } = sendMessageValidation(data);
      if (error) {
        console.log(`❌ Validation error:`, error.details[0].message);
        return socket.emit("error", { message: error.details[0].message });
      }

      const { matchId, content } = data;
      const match = await getMatchById(matchId, socket.user.id);
      
      if (!match) {
        console.log(`❌ Unauthorized message send attempt - matchId: ${matchId}, userId: ${socket.user.id}`);
        return socket.emit("error", { message: "Unauthorized match" });
      }

      const receiverId = match.userA.toString() === socket.user.id 
        ? match.userB.toString() 
        : match.userA.toString();

      const message = await createMessage({
        matchId,
        senderId: socket.user.id,
        receiverId,
        content
      });

      console.log(`✅ Message created - ID: ${message._id}`);

      const roomName = `match_${matchId}`;
      
      // Emit to everyone in the room (including sender)
      io.to(roomName).emit("newMessage", {
        _id: message._id,
        matchId: message.matchId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        seen: message.seen,
        createdAt: message.createdAt
      });

    } catch (err) {
      console.error("❌ sendMessage error:", err.message, err.stack);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Fetch messages with pagination
  socket.on("getMessages", async ({ matchId, limit = 50, skip = 0 }) => {
    try {
      console.log(`📖 getMessages request - matchId: ${matchId}, userId: ${socket.user.id}`);

      if (!matchId) {
        return socket.emit("error", { message: "Match ID is required" });
      }

      const match = await getMatchById(matchId, socket.user.id);
      if (!match) {
        console.log(`❌ Unauthorized messages fetch attempt - matchId: ${matchId}, userId: ${socket.user.id}`);
        return socket.emit("error", { message: "Unauthorized match" });
      }

      const messages = await getMessagesByMatch(matchId, limit, skip);
      console.log(`✅ Fetched ${messages.length} messages`);
      
      socket.emit("messagesList", messages.reverse()); // Oldest first

    } catch (err) {
      console.error("❌ getMessages error:", err.message);
      socket.emit("error", { message: "Failed to fetch messages" });
    }
  });

  // Mark messages as seen
  socket.on("markAsSeen", async ({ matchId, messageIds }) => {
    try {
      console.log(`👁️ markAsSeen request - matchId: ${matchId}, messageIds:`, messageIds);

      if (!matchId || !Array.isArray(messageIds) || messageIds.length === 0) {
        return socket.emit("error", { message: "Invalid request data" });
      }

      const match = await getMatchById(matchId, socket.user.id);
      if (!match) {
        return socket.emit("error", { message: "Unauthorized match" });
      }

      // Import Message model
      const Message = (await import("../models/Message.js")).default;

      // Mark messages as seen only if current user is the receiver
      const result = await Message.updateMany(
        {
          _id: { $in: messageIds },
          matchId,
          receiverId: socket.user.id,
          seen: false
        },
        { seen: true }
      );

      console.log(`✅ Marked ${result.modifiedCount} messages as seen`);

      // Notify the sender that messages were seen
      const roomName = `match_${matchId}`;
      socket.to(roomName).emit("messagesSeen", { messageIds });

    } catch (err) {
      console.error("❌ markAsSeen error:", err.message);
      socket.emit("error", { message: "Failed to mark messages as seen" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.user.id} (socket: ${socket.id})`);
  });
};

export default chatSocket;