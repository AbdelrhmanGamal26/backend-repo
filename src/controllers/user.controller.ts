import { Types } from 'mongoose';
import { Response } from 'express';
import { verifyToken } from '../utils/jwt';
import getTokenValue from '../utils/getTokenValue';
import { CustomRequest } from '../@types/generalTypes';
import * as userServices from '../services/user.service';
import setValueToCookies from '../utils/setValueToCookies';
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
  const currentToken = getTokenValue(req, 'jwt');
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
  const currentToken = getTokenValue(req, 'jwt');
  const newToken = await userServices.updateUserPassword(
    userId,
    oldPassword,
    newPassword,
    currentToken,
    confirmNewPassword,
  );
  setValueToCookies(res, 'jwt', newToken);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      token: newToken,
      message: 'Password updated successfully',
    },
  });
};

export const deleteMe = async (req: CustomRequest, res: Response) => {
  const userId = req.user!._id as Types.ObjectId;
  const currentToken = getTokenValue(req, 'jwt');
  await userServices.deleteMe(userId, currentToken);
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.status(RESPONSE_STATUSES.NO_CONTENT).json({
    status: 'Success',
  });
};

export const deleteUser = async (req: CustomRequest, res: Response) => {
  const userId = req.user!._id as Types.ObjectId;
  const role = req.user!.role;
  const { email } = req.body;
  const currentToken: string = getTokenValue(req, 'jwt');
  await userServices.deleteUser(userId, role, email, currentToken);
  res.status(RESPONSE_STATUSES.NO_CONTENT).json({
    status: 'Success',
  });
};

export const logout = async (req: CustomRequest, res: Response) => {
  const token = getTokenValue(req, 'jwt');
  const decoded = verifyToken(token);
  const expiresIn =
    decoded && typeof decoded.exp === 'number' ? decoded.exp - Math.floor(Date.now() / 1000) : 0;
  await blacklistToken(token, expiresIn);

  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'You have been logged out successfully.',
  });
};
