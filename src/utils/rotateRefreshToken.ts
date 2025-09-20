import { Response } from 'express';
import logger from './winston';
import clearCookieValue from './clearCookieValue';
import { UserDocument } from '../@types/userTypes';

const rotateRefreshToken = async (
  res: Response,
  oldToken: string,
  newToken: string,
  user: UserDocument,
): Promise<string> => {
  let updatedTokens = user.refreshToken || [];

  // If oldToken exists, remove it from user's tokens
  if (oldToken) {
    const tokenExists = updatedTokens.includes(oldToken);

    if (!tokenExists) {
      // Possible token reuse detected
      logger.warn('Attempted refresh token reuse at login!');

      // Invalidate all tokens
      user.refreshToken = [];
      await user.save({ validateBeforeSave: false });

      clearCookieValue(res, 'refreshToken');
      updatedTokens = [];
    } else {
      // Remove the old token
      updatedTokens = updatedTokens.filter((token) => token !== oldToken);
    }
  }

  // Add the new token and save the user
  user.refreshToken = [...updatedTokens, newToken];
  await user.save({ validateBeforeSave: false });

  return newToken;
};

export default rotateRefreshToken;
