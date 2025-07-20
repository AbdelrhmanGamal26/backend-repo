import dotenv from './src/utils/dotenv';
dotenv();

import mongoose from 'mongoose';
import app from './app';
import logger from './src/utils/winston';

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

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`listening on port ${port}...`);
});

process.on('unhandledRejection', (err: Error) => {
  logger.error(err.message);
  server.close(() => {
    process.exit(1);
  });
});
