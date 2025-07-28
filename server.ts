import dotenv from './src/utils/dotenv';
dotenv();

import http from 'http';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import logger from './src/utils/winston';
import { CORS_ORIGINS } from './src/constants/general';
import setupSocketHandlers from './src/websocket/socketHandler';

process.on('uncaughtException', (err) => {
  logger.error(err.message);
  process.exit(1);
});

const db: string = process.env.DATABASE ?? '';

mongoose
  .connect(db)
  .then(() => {
    console.log('connected to mongoDB...');
  })
  .catch((e) => console.log(e.message));

// Create raw HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGINS,
    credentials: true,
  },
});

// Attach websocket event handlers
setupSocketHandlers(io);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`listening on port ${port}...`);
});

process.on('unhandledRejection', (err: Error) => {
  logger.error(err.message);
  server.close(() => {
    process.exit(1);
  });
});
