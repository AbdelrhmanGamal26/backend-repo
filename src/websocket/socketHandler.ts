import { Server, Socket } from 'socket.io';

export default function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('joinRoom', ({ roomId }) => {
      socket.join(roomId);
    });

    socket.on('privateRoomChat', ({ roomId, msg, senderId }) => {
      console.log(roomId, msg);

      const messageWithSender = { ...msg, senderId };

      // io.to(roomId).emit('privateRoomChat', msg.content); // others
      // io.in(roomId).emit('privateRoomChat', msg.content);   // all

      socket.to(roomId).emit('privateRoomChat', { roomId, msg: messageWithSender }); // others
      socket.emit('privateRoomChat', { roomId, msg }); // sender
    });

    socket.on('leaveRoom', ({ roomId }) => {
      socket.leave(roomId);
      console.log(`Socket ${socket.id} left room ${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}
