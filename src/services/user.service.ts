import { Types } from 'mongoose';
import AppError from '../utils/appError';
import * as userDao from '../DAOs/user.dao';
import User from '../db/schemas/user.schema';
import { accountQueue } from '../utils/bull';
import { filterObj } from '../utils/generalUtils';
import { UserDocument } from '../@types/userTypes';
import { generateToken, verifyToken } from '../utils/jwt';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { ACCOUNT_STATES, BULL_ACCOUNT_JOB_NAME, USER_ROLES } from '../constants/general';

export const getUser = async (userId: string) => {
  return userDao.getUser(userId);
};

export const getAllUsers = async (params: { [key: string]: any }) => {
  return userDao.getAllUsers(params);
};

export const getAllActiveUsers = async (params: { [key: string]: any }) => {
  return userDao.getAllActiveUsers(params);
};

export const updateUserProfile = async (
  userId: Types.ObjectId,
  userData: { [key: string]: any },
  currentToken: string,
) => {
  const decoded = verifyToken(currentToken, 'JWT_ACCESS_TOKEN_SECRET');

  if (decoded.data !== userId.toString()) {
    throw new AppError(
      'You are not allowed to change other users data',
      RESPONSE_STATUSES.UNAUTHORIZED,
    );
  }

  if ('password' in userData || 'confirmPassword' in userData) {
    throw new AppError(
      'You can not update password from this route.',
      RESPONSE_STATUSES.BAD_REQUEST,
    );
  }

  const filteredUserData = filterObj(userData, 'name', 'photo');

  // N.B:
  // If you're hashing passwords (e.g., with bcrypt), you can’t do that inside findOneAndUpdate,
  // because Mongoose middleware doesn’t have access to the document instance (this refers to the query, not the doc).

  // To safely hash the password:
  // Avoid using findOneAndUpdate for password changes.
  // Instead, load the user, update the password, and call .save()
  const updatedUser: UserDocument | null = await User.findOneAndUpdate(
    { _id: userId },
    filteredUserData,
    {
      new: true, // this option is used to return the newly updated document
      runValidators: true, // this option is for running validation on the newly updated document
    },
  );

  if (!updatedUser) {
    throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  return updatedUser;
};

export const updateUserPassword = async (
  userId: Types.ObjectId,
  oldPassword: string,
  newPassword: string,
  confirmNewPassword: string,
  currentToken: string,
) => {
  const decoded = verifyToken(currentToken, 'JWT_ACCESS_TOKEN_SECRET');

  if (decoded.data !== userId.toString()) {
    throw new AppError(
      'You are not allowed to change other users password',
      RESPONSE_STATUSES.UNAUTHORIZED,
    );
  }

  const user = await User.findById(userId).select('+password');

  if (!user) {
    throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  const isPasswordCorrect = await user.correctPassword(oldPassword);

  if (!isPasswordCorrect) {
    throw new AppError('Your current password is not correct', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  if (oldPassword === newPassword) {
    throw new AppError(
      'New password must be different from the current one',
      RESPONSE_STATUSES.BAD_REQUEST,
    );
  }

  user.password = newPassword;
  user.confirmPassword = confirmNewPassword;
  await user.save();

  const accessToken = generateToken(
    user._id,
    'JWT_ACCESS_TOKEN_SECRET',
    'JWT_ACCESS_TOKEN_EXPIRES_IN',
  );
  const refreshToken = generateToken(
    user._id,
    'JWT_REFRESH_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_EXPIRES_IN',
  );

  return { accessToken, refreshToken };
};

export const deleteMe = async (userId: Types.ObjectId, currentToken: string) => {
  const decoded = verifyToken(currentToken, 'JWT_ACCESS_TOKEN_SECRET');

  if (decoded.data === userId.toString()) {
    const deletedUser = await User.findOneAndUpdate(
      { _id: userId },
      {
        accountState: ACCOUNT_STATES.INACTIVE,
        deleteAt: Date.now(),
      },
    );

    if (!deletedUser) {
      throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
    }

    try {
      await accountQueue.add(
        BULL_ACCOUNT_JOB_NAME.SEND_REMINDER,
        { email: deletedUser.email, name: deletedUser.name },
        {
          delay: 3 * 24 * 60 * 60 * 1000,
          jobId: `reminder-${deletedUser._id}`,
        },
      );
    } catch (err) {
      throw new AppError('Failed to send email', RESPONSE_STATUSES.SERVER);
    }
  } else {
    throw new AppError('You are not allowed to delete other users', RESPONSE_STATUSES.UNAUTHORIZED);
  }
};

export const deleteUser = async (
  userId: Types.ObjectId,
  role: string,
  email: string,
  currentToken: string,
) => {
  const decoded = verifyToken(currentToken, 'JWT_ACCESS_TOKEN_SECRET');

  if (decoded.data === userId.toString() && role === USER_ROLES.ADMIN) {
    const deletedUser = await User.findOneAndUpdate(
      { email },
      { accountState: ACCOUNT_STATES.INACTIVE, deleteAt: Date.now() },
    );

    if (!deletedUser) {
      throw new AppError('No user found with that email', RESPONSE_STATUSES.NOT_FOUND);
    }

    try {
      await accountQueue.add(
        BULL_ACCOUNT_JOB_NAME.SEND_REMINDER,
        { email: deletedUser.email, name: deletedUser.name },
        {
          delay: 3 * 24 * 60 * 60 * 1000,
          jobId: `reminder-${deletedUser._id}`,
        },
      );
    } catch (err) {
      throw new AppError('Failed to send email', RESPONSE_STATUSES.SERVER);
    }
  } else {
    throw new AppError(
      'You are not allowed to delete users through this route.',
      RESPONSE_STATUSES.UNAUTHORIZED,
    );
  }
};

export const logout = async (id: Types.ObjectId) => {
  const currentUser = await User.findById(id).select('+refreshToken');

  if (!currentUser) {
    throw new AppError('No user found for that id', RESPONSE_STATUSES.NOT_FOUND);
  }

  currentUser.refreshToken = undefined;
  await currentUser.save({ validateBeforeSave: false });

  return;
};
