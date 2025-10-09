import { Types } from 'mongoose';
import logger from '../utils/winston';
import AppError from '../utils/appError';
import * as userDao from '../DAOs/user.dao';
import DURATIONS from '../constants/durations';
import { filterObj } from '../utils/generalUtils';
import { generateToken, verifyToken } from '../utils/jwt';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { accountRemovalQueue, reminderQueue } from '../utils/bull';
import { ACCOUNT_STATES, EMAIL_SENT_STATUS } from '../constants/general';
import { sendAccountDeletionEmail, sendAccountDeletionReminderEmail } from '../utils/bullmqJobs';

// ================================= Start of get user =================================== //
export const getUser = async (userId: Types.ObjectId) => userDao.getUserById(userId);
// ================================= End of get user =================================== //

// ================================= Start of get all users =================================== //
export const getAllUsers = async (params: { [key: string]: any }) => userDao.getAllUsers(params);
// ================================= End of get all users =================================== //

// ================================= Start of get all active users =================================== //
export const getAllActiveUsers = async (params: { [key: string]: any }) =>
  userDao.getAllActiveUsers(params);
// ================================= End of get all active users =================================== //

// ================================= Start of update user profile =================================== //
export const updateUserProfile = async (
  userId: Types.ObjectId,
  userData: { [key: string]: any },
  currentAccessToken: string,
) => {
  const decoded = verifyToken(currentAccessToken, 'JWT_ACCESS_TOKEN_SECRET');

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
  const updatedUser = await userDao.updateUserData({ _id: userId }, filteredUserData, {
    new: true, // this option is used to return the newly updated document
    runValidators: true, // this option is for running validation on the newly updated document
  });

  if (!updatedUser) {
    throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  if (updatedUser.accountState === ACCOUNT_STATES.INACTIVE) {
    throw new AppError('This account is inactive', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  return updatedUser;
};
// ================================= End of update user profile =================================== //

// ================================= Start of update user password =================================== //
export const updateUserPassword = async (
  userId: Types.ObjectId,
  oldPassword: string,
  newPassword: string,
  confirmNewPassword: string,
  currentAccessToken: string,
) => {
  const decoded = verifyToken(currentAccessToken, 'JWT_ACCESS_TOKEN_SECRET');

  if (decoded.data !== userId.toString()) {
    throw new AppError(
      'You are not allowed to change other users password',
      RESPONSE_STATUSES.UNAUTHORIZED,
    );
  }

  const user = await userDao.getUserById(userId).select('+password');

  if (!user) {
    throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  if (user.accountState === ACCOUNT_STATES.INACTIVE) {
    throw new AppError('This account is inactive', RESPONSE_STATUSES.UNAUTHORIZED);
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

  // update password
  user.password = newPassword;
  user.confirmPassword = confirmNewPassword;
  user.changedPasswordAt = new Date();
  await user.save();

  // invalidate old refresh tokens
  user.refreshToken = [];

  // generate new access and refresh token
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

  // store the new refresh token in DB
  user.refreshToken.push(refreshToken);

  await user.save();

  // log user password update time
  logger.info(`User ${userId} updated password at ${new Date().toISOString()}`);

  // return the new tokens
  return { accessToken, refreshToken };
};
// ================================= End of update user password =================================== //

// ================================= Start of delete me =================================== //
export const deleteMe = async (userId: Types.ObjectId, currentAccessToken: string) => {
  const decoded = verifyToken(currentAccessToken, 'JWT_ACCESS_TOKEN_SECRET');

  if (decoded.data !== userId.toString()) {
    throw new AppError('You are not allowed to delete other users', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  const deletedUser = await userDao.updateUserData(
    { _id: userId },
    {
      accountState: ACCOUNT_STATES.INACTIVE,
    },
    {
      new: true,
      runValidators: false,
    },
  );

  if (!deletedUser) {
    throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  deletedUser.refreshToken = [];
  deletedUser.deletedAt = new Date();
  deletedUser.logoutAt = new Date();
  await deletedUser.save({ validateBeforeSave: false });

  logger.info(`User ${userId} soft-deleted their account at ${new Date().toISOString()}`);

  try {
    const jobDelay = DURATIONS.BULL_JOB_ACCOUNT_REMOVAL_AFTER_SOFT_DELETE_PERIOD;
    const accountDeletionReminderDelay = jobDelay - DURATIONS.ACCOUNT_DELETION_EMAIL_GRACE_PERIOD;

    await sendAccountDeletionReminderEmail(deletedUser, accountDeletionReminderDelay);
    await sendAccountDeletionEmail(deletedUser, jobDelay);

    deletedUser.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.PENDING;
    deletedUser.accountInactivationReminderEmailSentAt = undefined;
    await deletedUser.save({ validateBeforeSave: false });
  } catch (err) {
    logger.error(
      `Failed to queue account deletion emails for ${deletedUser.email}:`,
      err instanceof Error ? err.stack : err,
    );
  }
};
// ================================= End of delete me =================================== //

// ================================= Start of delete user =================================== //
export const deleteUser = async (email: string) => {
  const deletedUser = await userDao.updateUserData(
    { email },
    {
      accountState: ACCOUNT_STATES.DELETED,
    },
    {
      new: true,
      runValidators: false,
    },
  );

  if (!deletedUser) {
    throw new AppError('No user found with that email', RESPONSE_STATUSES.NOT_FOUND);
  }

  deletedUser.refreshToken = [];
  deletedUser.deletedAt = new Date();
  deletedUser.logoutAt = new Date();
  await deletedUser.save({ validateBeforeSave: false });

  logger.info(
    `Admin soft-deleted the user with ID: ${deletedUser._id} at ${new Date().toISOString()}`,
  );

  try {
    const jobDelay = DURATIONS.BULL_JOB_ACCOUNT_REMOVAL_AFTER_SOFT_DELETE_PERIOD;
    const accountDeletionReminderDelay = jobDelay - DURATIONS.ACCOUNT_DELETION_EMAIL_GRACE_PERIOD;

    await sendAccountDeletionReminderEmail(deletedUser, accountDeletionReminderDelay);
    await sendAccountDeletionEmail(deletedUser, jobDelay);

    deletedUser.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.PENDING;
    deletedUser.accountInactivationReminderEmailSentAt = undefined;
    await deletedUser.save({ validateBeforeSave: false });
  } catch (err) {
    logger.error(
      `Failed to queue account deletion emails for ${deletedUser.email}:`,
      err instanceof Error ? err.stack : err,
    );
  }
};
// ================================= End of delete user =================================== //

// ================================= Start of logout =================================== //
export const logout = async (userId: Types.ObjectId) => {
  const currentUser = await userDao.getUserById(userId).select('+refreshToken');

  if (!currentUser) {
    throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  if (currentUser.accountState === ACCOUNT_STATES.INACTIVE) {
    throw new AppError('This account is inactive', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  currentUser.refreshToken = [];
  currentUser.logoutAt = new Date();
  await currentUser.save({ validateBeforeSave: false });

  const jobDelay = DURATIONS.BULL_JOB_ACCOUNT_REMOVAL_AFTER_SOFT_DELETE_PERIOD;
  const accountDeletionReminderDelay = jobDelay - DURATIONS.ACCOUNT_DELETION_EMAIL_GRACE_PERIOD;

  try {
    // clean up first of unremoved jobs
    await reminderQueue.remove(`reminder-${currentUser._id}`).catch(() => {});
    await accountRemovalQueue.remove(`removal-${currentUser._id}`).catch(() => {});

    await sendAccountDeletionReminderEmail(currentUser, accountDeletionReminderDelay);
    await sendAccountDeletionEmail(currentUser, jobDelay);
  } catch (error) {
    logger.error(
      `Failed to queue logout-related emails for user ${currentUser.email}: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
};
// ================================= End of logout =================================== //
