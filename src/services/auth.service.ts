import { Types } from 'mongoose';
import { Response } from 'express';
import {
  sendForgotPasswordEmail,
  sendAccountDeletionEmail,
  sendAccountActivationEmail,
  sendAccountDeletionReminderEmail,
} from '../utils/bullmqJobs';
import logger from '../utils/winston';
import AppError from '../utils/appError';
import User from '../db/schemas/user.schema';
import DURATIONS from '../constants/durations';
import { hashToken } from '../utils/generalUtils';
import { userIsVerified } from '../utils/userUtils';
import clearCookieValue from '../utils/clearCookieValue';
import { generateToken, verifyToken } from '../utils/jwt';
import setValueToCookies from '../utils/setValueToCookies';
import rotateRefreshToken from '../utils/rotateRefreshToken';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { EMAIL_SENT_STATUS, EMAIL_VERIFICATION_STATUSES } from '../constants/general';
import reactivateUserIfWithinGracePeriod from '../utils/reactivateUserIfWithinGracePeriod';
import { checkLoginAttempts, clearLoginAttempts, recordFailedAttempt } from '../utils/redis';
import { reminderQueue, emailQueue, accountRemovalQueue, forgotPasswordQueue } from '../utils/bull';

type CreatedUserType = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export const createUser = async (data: CreatedUserType) => {
  const createdUser = await User.create(data);

  if (!createdUser) {
    throw new AppError('Failed to create user', RESPONSE_STATUSES.SERVER);
  }

  createdUser.signupAt = new Date();

  const verificationToken = createdUser.createEmailVerificationToken(
    DURATIONS.EMAIL_VERIFICATION_TOKEN_AGE,
  );

  await createdUser.save({ validateBeforeSave: false });

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?verificationToken=${verificationToken}`;

  try {
    await emailQueue.remove(`email-${createdUser._id}`); // Clean up job queue first
    await sendAccountActivationEmail(createdUser, verificationUrl);

    // send delete account permanently reminder email if user does not activate
    await reminderQueue.remove(`reminder-${createdUser._id}`); // Clean up job queue first
    await sendAccountDeletionReminderEmail(
      createdUser,
      DURATIONS.BULL_JOB_ACCOUNT_REMOVAL_AFTER_SIGNUP_WITHOUT_VERIFICATION_PERIOD,
    );
    await accountRemovalQueue.remove(`removal-${createdUser._id}`); // Clean up job queue first
    await sendAccountDeletionEmail(
      createdUser,
      DURATIONS.TIME_TO_DELETE_AFTER_SIGNUP_WITHOUT_ACTIVATION,
    );
  } catch (err) {
    logger.error(`Failed to queue email verification job for user: ${createdUser.email}`);
    throw new AppError('Failed to queue email for sending', RESPONSE_STATUSES.SERVER);
  }
};

type UserLoginReturnDataType = {
  _id: Types.ObjectId;
  __v: number;
  name: string;
  email: string;
};

export const login = async (
  userData: {
    email: string;
    password: string;
  },
  res: Response,
  jwt: string,
): Promise<{ user: UserLoginReturnDataType; accessToken: string; refreshToken: string }> => {
  const user = await User.findOne({
    email: userData.email,
  }).select('+password +isVerified +deleteAt +accountState +refreshToken');

  // Store the login attempt
  await checkLoginAttempts(userData.email);

  if (!user) {
    await recordFailedAttempt(userData.email);
    await new Promise((res) => setTimeout(res, 300)); // Timing normalization
    throw new AppError('Incorrect email or password', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  // check user verification status
  userIsVerified(user);

  const isPasswordCorrect = await user.correctPassword(userData.password);

  if (!isPasswordCorrect) {
    await recordFailedAttempt(userData.email);
    throw new AppError('Incorrect email or password', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  // Reactivate user account if it's inactive and still within reactivation grace period
  await reactivateUserIfWithinGracePeriod(user);

  // Remove any account deletion reminder job
  await reminderQueue.remove(`reminder-${user._id}`);
  await accountRemovalQueue.remove(`removal-${user._id}`);

  await clearLoginAttempts(userData.email);

  const refreshTokenValue = generateToken(
    user._id,
    'JWT_REFRESH_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_EXPIRES_IN',
  );

  // Handle Token Rotation
  const newRefreshTokenArray = await rotateRefreshToken(res, jwt, refreshTokenValue, user);

  user.loginAt = new Date();
  user.logoutAt = undefined;
  user.refreshToken = [...newRefreshTokenArray];
  await user.save({ validateBeforeSave: false });

  const accessToken = generateToken(
    user._id,
    'JWT_ACCESS_TOKEN_SECRET',
    'JWT_ACCESS_TOKEN_EXPIRES_IN',
  );

  const {
    role,
    loginAt,
    deleteAt,
    password,
    isVerified,
    accountState,
    refreshToken,
    ...restUserData
  } = user.toObject();

  return { user: restUserData, accessToken, refreshToken: refreshTokenValue };
};

export const refreshAccessToken = async (res: Response, refreshToken: string): Promise<string> => {
  if (!refreshToken) {
    throw new AppError(
      'You are not logged in. Please login first.',
      RESPONSE_STATUSES.UNAUTHORIZED,
    );
  }

  // Clear the old cookie immediately
  clearCookieValue(res, 'refreshToken');

  let payload;
  try {
    payload = verifyToken(refreshToken, 'JWT_REFRESH_TOKEN_SECRET');
  } catch (err) {
    payload = null;
  }

  // If token can't be verified, stop here
  if (!payload) {
    throw new AppError('Invalid or expired refresh token', RESPONSE_STATUSES.FORBIDDEN);
  }

  // Find user by refresh token
  const user = await User.findOne({ refreshToken }).select('+refreshToken');
  const newRefreshToken = generateToken(
    payload.data,
    'JWT_REFRESH_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_EXPIRES_IN',
  );

  if (!user) {
    // Token reuse detected
    logger.warn('Refresh token reuse detected!');
    const hackedUser = await User.findById(payload.data);
    if (hackedUser) {
      hackedUser.refreshToken = [];
      await hackedUser.save();
    }

    throw new AppError(
      'Token reuse attempt detected. Please login again.',
      RESPONSE_STATUSES.FORBIDDEN,
    );
  }

  // Token is valid and user exists → rotate refresh token
  user.refreshToken = user.refreshToken.filter((rt) => rt !== refreshToken);
  user.refreshToken.push(newRefreshToken);
  await user.save();

  // Set new refresh token in cookie
  setValueToCookies(res, 'refreshToken', newRefreshToken);

  const newAccessToken = generateToken(
    user._id.toString(),
    'JWT_ACCESS_TOKEN_SECRET',
    'JWT_ACCESS_TOKEN_EXPIRES_IN',
  );

  return newAccessToken;
};

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await User.findOne({ email }).select('+isVerified');

  if (!user) {
    throw new AppError('No user found with that email', RESPONSE_STATUSES.NOT_FOUND);
  }

  // check user verification status
  userIsVerified(user);

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?resetToken=${resetToken}`;

  try {
    await forgotPasswordQueue.remove(`forgot-${user._id}`); // Cleanup first
    await sendForgotPasswordEmail(user, resetUrl);
  } catch (err) {
    logger.error(`Failed to queue email verification job for user: ${user.email}`);
    throw new AppError('Failed to queue email for sending', RESPONSE_STATUSES.SERVER);
  }
};

export const verifyResetToken = async (resetToken: string) => {
  const hashedToken = hashToken(resetToken);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetTokenExpires: { $gt: Date.now() },
  }).select('+isVerified');

  if (!user) {
    throw new AppError('Invalid token or token expired', RESPONSE_STATUSES.BAD_REQUEST);
  }

  // check user verification status
  userIsVerified(user);

  return;
};

export const resetPassword = async (resetToken: string, password: string): Promise<void> => {
  const hashedToken = hashToken(resetToken);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetTokenExpires: { $gt: Date.now() },
  }).select('+isVerified');

  if (!user) {
    throw new AppError('Invalid token or token expired', RESPONSE_STATUSES.BAD_REQUEST);
  }

  // check user verification status
  userIsVerified(user);

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpires = undefined;
  await user.save();

  // Remove the password reset job
  await forgotPasswordQueue.remove(`forgot-${user._id}`); // Cleanup first
};

export const verifyEmail = async (verificationToken: string): Promise<string> => {
  const hashedToken = hashToken(verificationToken);

  const user = await User.findOne({
    verifyEmailToken: hashedToken,
    verifyEmailTokenExpires: { $gt: Date.now() },
  });

  if (!user) {
    return EMAIL_VERIFICATION_STATUSES.INVALID_OR_EXPIRED;
  }

  if (user.isVerified) {
    return EMAIL_VERIFICATION_STATUSES.ALREADY_VERIFIED;
  }

  user.isVerified = true;
  user.verifiedAt = new Date();
  user.verifyEmailToken = undefined;
  user.verifyEmailTokenExpires = undefined;
  await user.save();

  await emailQueue.remove(`email-${user._id}`);
  await reminderQueue.remove(`reminder-${user._id}`);
  await accountRemovalQueue.remove(`removal-${user._id}`);

  return EMAIL_VERIFICATION_STATUSES.VERIFIED;
};

export const resendVerificationToken = async (email: string): Promise<string | void> => {
  const user = await User.findOne({ email }).select('+isVerified');

  if (!user) {
    throw new AppError('No user found with that email', RESPONSE_STATUSES.NOT_FOUND);
  }

  if (user.isVerified) {
    return EMAIL_VERIFICATION_STATUSES.ALREADY_VERIFIED;
  }

  // Optional: rate-limit resend
  if (
    user.accountActivationEmailSentAt &&
    Date.now() - user.accountActivationEmailSentAt.getTime() <
      DURATIONS.RATE_LIMIT_RESEND_TOKEN_COOLDOWN_PERIOD
  ) {
    throw new AppError('Please wait before requesting again', RESPONSE_STATUSES.TOO_MANY_REQUESTS);
  }

  const verificationToken = user.createEmailVerificationToken(
    DURATIONS.EMAIL_VERIFICATION_TOKEN_AGE,
  );

  user.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.PENDING;
  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?verificationToken=${verificationToken}`;

  try {
    await emailQueue.remove(`email-${user._id}`);
    await sendAccountActivationEmail(user, verificationUrl);

    user.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.PENDING;
    user.accountActivationEmailSentAt = undefined;
    await user.save({ validateBeforeSave: false });
  } catch (err) {
    logger.error(`Failed to queue email verification job for user: ${user.email}`);
    throw new AppError('Failed to queue email for sending', RESPONSE_STATUSES.SERVER);
  }
};
