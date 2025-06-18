import redisClient from '../utils/redis';

export const blacklistToken = async (token: string, expiresInSeconds: number) => {
  await redisClient.setEx(`bl:${token}`, expiresInSeconds, 'blacklisted');
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const result = await redisClient.get(`bl:${token}`);
  return result === 'blacklisted';
};
