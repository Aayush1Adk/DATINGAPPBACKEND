// A simple in-memory map to track online users
// Key: userId, Value: socketId
const onlineUsers = new Map();

const presenceSocket = (io, socket) => {
  
  // Add user to online map
  onlineUsers.set(socket.user.id, socket.id);

  // Notify the user's matches that this user is online
  const notifyMatches = async () => {
    try {
      const Match = (await import("../models/Match.js")).default;

      const matches = await Match.find({
        $or: [{ userA: socket.user.id }, { userB: socket.user.id }]
      });

      matches.forEach(match => {
        const otherUserId = match.userA.toString() === socket.user.id
          ? match.userB.toString()
          : match.userA.toString();

        const otherSocketId = onlineUsers.get(otherUserId);
        if (otherSocketId) {
          io.to(otherSocketId).emit("matchOnline", { userId: socket.user.id });
        }
      });
    } catch (err) {
      console.error("Error notifying matches:", err.message);
    }
  };

  notifyMatches();

  // Optional: send initial online status of matches to this user
  const sendInitialOnlineMatches = async () => {
    try {
      const Match = (await import("../models/Match.js")).default;

      const matches = await Match.find({
        $or: [{ userA: socket.user.id }, { userB: socket.user.id }]
      });

      const onlineMatches = matches
        .map(match => {
          const otherUserId = match.userA.toString() === socket.user.id
            ? match.userB.toString()
            : match.userA.toString();
          if (onlineUsers.has(otherUserId)) return otherUserId;
          return null;
        })
        .filter(Boolean);

      socket.emit("onlineMatches", { users: onlineMatches });
    } catch (err) {
      console.error("Error sending initial online matches:", err.message);
    }
  };

  sendInitialOnlineMatches();

  // Handle disconnect
  socket.on("disconnect", async () => {
    onlineUsers.delete(socket.user.id);

    try {
      const Match = (await import("../models/Match.js")).default;

      const matches = await Match.find({
        $or: [{ userA: socket.user.id }, { userB: socket.user.id }]
      });

      matches.forEach(match => {
        const otherUserId = match.userA.toString() === socket.user.id
          ? match.userB.toString()
          : match.userA.toString();

        const otherSocketId = onlineUsers.get(otherUserId);
        if (otherSocketId) {
          io.to(otherSocketId).emit("matchOffline", { userId: socket.user.id });
        }
      });
    } catch (err) {
      console.error("Error notifying matches offline:", err.message);
    }
  });
};

export default presenceSocket;
