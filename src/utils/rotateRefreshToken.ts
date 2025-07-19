import { Response } from 'express';
import User from '../db/schemas/user.schema';
import clearCookieValue from './clearCookieValue';
import { UserDocument } from '../@types/userTypes';

const rotateRefreshToken = async (
  res: Response,
  oldToken: string,
  newToken: string,
  user: UserDocument,
): Promise<string[]> => {
  let updatedTokens = user.refreshToken || [];

  // If oldToken exists, remove it from user's tokens
  if (oldToken) {
    const tokenExists = await User.findOne({ refreshToken: oldToken }).select('+refreshToken');

    if (!tokenExists) {
      console.warn('Attempted refresh token reuse at login!');

      // Invalidate all tokens
      user.refreshToken = [];
      await user.save({ validateBeforeSave: false });

      clearCookieValue(res, 'refreshToken');
      return [newToken];
    }

    // If token is valid and exists, rotate it out
    updatedTokens = updatedTokens.filter((token) => token !== oldToken);
    clearCookieValue(res, 'refreshToken');
  }

  return [...updatedTokens, newToken];
};

export default rotateRefreshToken;
