import { Types } from 'mongoose';
import { Response } from 'express';
import { verifyToken } from '../utils/jwt';
import DURATIONS from '../constants/durations';
import { CustomRequest } from '../@types/generalTypes';
import * as userServices from '../services/user.service';
import clearCookieValue from '../utils/clearCookieValue';
import setValueToCookies from '../utils/setValueToCookies';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import getTokenValueFromHeaders from '../utils/getTokenValueFromHeaders';

export const getUser = async (req: CustomRequest, res: Response) => {
  const userId = req.user!._id;
  const user = await userServices.getUser(userId);
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
  const userId = req.user!._id;
  const currentAccessToken = getTokenValueFromHeaders(req);
  const updatedUser = await userServices.updateUserProfile(userId, req.body, currentAccessToken);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      user: updatedUser,
    },
  });
};

export const updateUserPassword = async (req: CustomRequest, res: Response) => {
  const userId = req.user!._id;
  const { oldPassword, newPassword, confirmNewPassword } = req.body;
  const currentAccessToken = getTokenValueFromHeaders(req);

  const { accessToken, refreshToken } = await userServices.updateUserPassword(
    userId,
    oldPassword,
    newPassword,
    confirmNewPassword,
    currentAccessToken,
  );

  setValueToCookies(res, 'refreshToken', refreshToken, DURATIONS.REFRESH_TOKEN_MAX_AGE);

  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      accessToken,
      message: 'Password updated successfully',
    },
  });
};

export const deleteMe = async (req: CustomRequest, res: Response) => {
  const userId = req.user?._id as Types.ObjectId;
  const currentAccessToken = getTokenValueFromHeaders(req);
  await userServices.deleteMe(userId, currentAccessToken);

  clearCookieValue(res, 'refreshToken');

  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'Account deleted',
    data: null,
  });
};

export const deleteUser = async (req: CustomRequest, res: Response) => {
  await userServices.deleteUser(req.body.email);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'Account deleted',
    data: null,
  });
};

export const logout = async (req: CustomRequest, res: Response) => {
  const accessToken = getTokenValueFromHeaders(req);
  const decoded = verifyToken(accessToken, 'JWT_ACCESS_TOKEN_SECRET');

  await userServices.logout(decoded.data);

  clearCookieValue(res, 'refreshToken');

  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'logout successful!',
  });
};
