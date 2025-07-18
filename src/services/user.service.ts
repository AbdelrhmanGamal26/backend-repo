import { Types } from 'mongoose';
import { USER_ROLES, ACCOUNT_STATES, EMAIL_SENT_STATUS } from '../constants/general';
import AppError from '../utils/appError';
import * as userDao from '../DAOs/user.dao';
import User from '../db/schemas/user.schema';
import DURATIONS from '../constants/durations';
import { filterObj } from '../utils/generalUtils';
import { UserDocument } from '../@types/userTypes';
import { generateToken, verifyToken } from '../utils/jwt';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { accountRemovalQueue, reminderQueue } from '../utils/bull';
import { sendAccountDeletionEmail, sendAccountDeletionReminderEmail } from '../utils/bullmqJobs';

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
      },
    );

    if (!deletedUser) {
      throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
    }

    deletedUser.deleteAt = new Date();
    await deletedUser.save({ validateBeforeSave: false });

    const jobDelay =
      deletedUser.deleteAt.getTime() + DURATIONS.BULL_JOB_ACCOUNT_REMOVAL_AFTER_SOFT_DELETE_PERIOD;
    const accountDeletionReminderDelay = jobDelay - DURATIONS.ACCOUNT_DELETION_EMAIL_GRACE_PERIOD;

    try {
      await sendAccountDeletionReminderEmail(deletedUser, accountDeletionReminderDelay);
      await sendAccountDeletionEmail(deletedUser, jobDelay);

      deletedUser.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.PENDING;
      deletedUser.accountInactivationReminderEmailSentAt = undefined;
      await deletedUser.save({ validateBeforeSave: false });
    } catch (err) {
      throw new AppError('Failed to queue email for sending', RESPONSE_STATUSES.SERVER);
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
      { accountState: ACCOUNT_STATES.INACTIVE },
    );

    if (!deletedUser) {
      throw new AppError('No user found with that email', RESPONSE_STATUSES.NOT_FOUND);
    }

    deletedUser.deleteAt = new Date();
    await deletedUser.save({ validateBeforeSave: false });

    const jobDelay =
      deletedUser.deleteAt.getTime() + DURATIONS.BULL_JOB_ACCOUNT_REMOVAL_AFTER_SOFT_DELETE_PERIOD;
    const accountDeletionReminderDelay = jobDelay - DURATIONS.ACCOUNT_DELETION_EMAIL_GRACE_PERIOD;

    try {
      await sendAccountDeletionReminderEmail(deletedUser, accountDeletionReminderDelay);
      await sendAccountDeletionEmail(deletedUser, jobDelay);

      deletedUser.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.PENDING;
      deletedUser.accountInactivationReminderEmailSentAt = undefined;
      await deletedUser.save({ validateBeforeSave: false });
    } catch (err) {
      throw new AppError('Failed to queue email for sending', RESPONSE_STATUSES.SERVER);
    }
  } else {
    throw new AppError(
      'You are not allowed to delete users through this route.',
      RESPONSE_STATUSES.UNAUTHORIZED,
    );
  }
};

export const logout = async (userId: Types.ObjectId) => {
  const currentUser = await User.findById(userId).select('+refreshToken');

  if (!currentUser) {
    throw new AppError('No user found for that id', RESPONSE_STATUSES.NOT_FOUND);
  }

  currentUser.refreshToken = [];
  currentUser.logoutAt = new Date();
  await currentUser.save({ validateBeforeSave: false });

  const jobDelay =
    currentUser.logoutAt.getTime() + DURATIONS.BULL_JOB_ACCOUNT_REMOVAL_AFTER_SOFT_DELETE_PERIOD;
  const accountDeletionReminderDelay = jobDelay - DURATIONS.ACCOUNT_DELETION_EMAIL_GRACE_PERIOD;

  try {
    await reminderQueue.remove(`reminder-${currentUser._id}`);
    await sendAccountDeletionReminderEmail(currentUser, accountDeletionReminderDelay);
    await accountRemovalQueue.remove(`removal-${currentUser._id}`);
    await sendAccountDeletionEmail(currentUser, jobDelay);
  } catch (error) {
    throw new AppError('Failed to queue email for sending', RESPONSE_STATUSES.SERVER);
  }

  return;
};
