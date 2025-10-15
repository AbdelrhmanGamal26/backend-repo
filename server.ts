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
const port = process.env.PORT || 3000;

// Connect to MongoDB, then start server
mongoose
  .connect(db)
  .then(() => {
    console.log('connected to mongoDB...');
    server.listen(port, () => {
      console.log(`listening on port ${port}...`);
    });
  })
  .catch((e) => console.log(`MongoDB connection failed: ${e.message}`));

// Create raw HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.IO
export const io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGINS,
    credentials: true,
  },
});

// Attach websocket event handlers
setupSocketHandlers(io);

process.on('unhandledRejection', (err: Error) => {
  logger.error(err.message);
  server.close(async () => {
    await mongoose.connection.close();
    process.exit(1);
  });
});

// Graceful shutdown (CTRL+C)
process.on('SIGINT', async () => {
  logger.info('Gracefully shutting down...');
  await mongoose.connection.close();
  server.close(() => process.exit(0));
});
