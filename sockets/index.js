import chatSocket from "./chat.socket.js";
import presenceSocket from "./presence.socket.js";

const registerSockets = (io) => {
  io.on("connection", (socket) => {
    console.log(`✅ Socket connected: ${socket.id} | User: ${socket.user.id}`);
    
    chatSocket(io, socket);
    presenceSocket(io, socket);
  });
};

export default registerSockets;     