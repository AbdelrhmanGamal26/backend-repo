import { Types } from 'mongoose';
import { Response } from 'express';
import { verifyToken } from '../utils/jwt';
import getTokenValue from '../utils/getTokenValue';
import { CustomRequest } from '../@types/generalTypes';
import * as userServices from '../services/user.service';
import clearCookieValue from '../utils/clearCookieValue';
import setValueToCookies from '../utils/setValueToCookies';
import { REFRESH_TOKEN_MAX_AGE } from '../constants/general';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { blacklistToken } from '../utils/tokenBlackListingUtils';

export const getUser = async (req: CustomRequest, res: Response) => {
  const userId = req.user!._id as Types.ObjectId;
  const user = await userServices.getUser(userId.toString());
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      user,
    },
  });
};

export const getAllUsers = async (req: CustomRequest, res: Response) => {
  const users = await userServices.getAllUsers(req.query);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      users,
    },
  });
};

export const getAllActiveUsers = async (req: CustomRequest, res: Response) => {
  const users = await userServices.getAllActiveUsers(req.query);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      users,
    },
  });
};

export const updateUserProfile = async (req: CustomRequest, res: Response) => {
  const userId = req.user!._id as Types.ObjectId;
  const currentToken = getTokenValue(req, 'accessToken');
  const updatedUser = await userServices.updateUserProfile(userId, req.body, currentToken);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      user: updatedUser,
    },
  });
};

export const updateUserPassword = async (req: CustomRequest, res: Response) => {
  const userId = req.user!._id as Types.ObjectId;
  const { oldPassword, newPassword, confirmNewPassword } = req.body;
  const currentToken = getTokenValue(req, 'accessToken');
  const { accessToken, refreshToken } = await userServices.updateUserPassword(
    userId,
    oldPassword,
    newPassword,
    currentToken,
    confirmNewPassword,
  );

  setValueToCookies(res, 'accessToken', accessToken);
  setValueToCookies(res, 'refreshToken', refreshToken, REFRESH_TOKEN_MAX_AGE);

  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      accessToken,
      message: 'Password updated successfully',
    },
  });
};

export const deleteMe = async (req: CustomRequest, res: Response) => {
  const userId = req.user!._id as Types.ObjectId;
  const currentToken = getTokenValue(req, 'accessToken');
  await userServices.deleteMe(userId, currentToken);

  clearCookieValue(res, 'accessToken');
  clearCookieValue(res, 'refreshToken');

  res.status(RESPONSE_STATUSES.NO_CONTENT).json({
    status: 'Success',
  });
};

export const deleteUser = async (req: CustomRequest, res: Response) => {
  const userId = req.user!._id as Types.ObjectId;
  const role = req.user!.role;
  const { email } = req.body;
  const currentToken: string = getTokenValue(req, 'accessToken');
  await userServices.deleteUser(userId, role, email, currentToken);
  res.status(RESPONSE_STATUSES.NO_CONTENT).json({
    status: 'Success',
  });
};

export const logout = async (req: CustomRequest, res: Response) => {
  const token = getTokenValue(req, 'accessToken');
  const decoded = verifyToken(token, 'JWT_ACCESS_TOKEN_SECRET');
  const expiresIn =
    decoded && typeof decoded.exp === 'number' ? decoded.exp - Math.floor(Date.now() / 1000) : 0;

  await blacklistToken(token, expiresIn);
  clearCookieValue(res, 'accessToken');
  clearCookieValue(res, 'refreshToken');

  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'You have been logged out successfully.',
  });
};
