import { createClient } from 'redis';
import logger from './winston';
import AppError from './appError';
import RESPONSE_STATUSES from '../constants/responseStatuses';

const redisClient = createClient();

redisClient.on('error', (err) => logger.error(`connection to redis failed: ${err}`));
redisClient.on('connect', () => logger.info('connected to redis db successfully'));

(async () => await redisClient.connect())();

// constants
const MAX_ATTEMPTS = 5;
const BLOCK_TIME = 60 * 15; // 15 minutes in seconds

export const checkLoginAttempts = async (email: string) => {
  const key = `login:attempts:${email}`;

  const attempts = parseInt((await redisClient.get(key)) || '0');

  if (attempts >= MAX_ATTEMPTS) {
    throw new AppError(
      'Too many login attempts. Please wait for 15 minutes then try again.',
      RESPONSE_STATUSES.TOO_MANY_REQUESTS,
    );
  }
};

export const recordFailedAttempt = async (email: string) => {
  const key = `login:attempts:${email}`;

  const attempts = await redisClient.incr(key);

  if (attempts === 1) {
    await redisClient.expire(key, BLOCK_TIME);
  }
};

export const clearLoginAttempts = async (email: string) => {
  const key = `login:attempts:${email}`;
  await redisClient.del(key);
};

export default redisClient;
