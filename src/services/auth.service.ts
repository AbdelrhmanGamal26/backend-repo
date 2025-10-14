import { Response } from 'express';
import { Types } from 'mongoose';
import {
  sendForgotPasswordEmail,
  sendAccountDeletionEmail,
  sendAccountActivationEmail,
  sendAccountDeletionReminderEmail,
} from '../utils/bullmqJobs';
import logger from '../utils/winston';
import AppError from '../utils/appError';
import * as userDao from '../DAOs/user.dao';
import DURATIONS from '../constants/durations';
import { hashToken } from '../utils/generalUtils';
import { userIsVerified } from '../utils/userUtils';
import { CreatedUserType } from '../@types/userTypes';
import clearCookieValue from '../utils/clearCookieValue';
import { ServiceResponse } from '../@types/generalTypes';
import { generateToken, verifyToken } from '../utils/jwt';
import setValueToCookies from '../utils/setValueToCookies';
import rotateRefreshToken from '../utils/rotateRefreshToken';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { uploadToCloudinary } from '../utils/cloudinary';
import { ACCOUNT_STATES, EMAIL_SENT_STATUS } from '../constants/general';
import reactivateUserIfWithinGracePeriod from '../utils/reactivateUserIfWithinGracePeriod';
import { checkLoginAttempts, clearLoginAttempts, recordFailedAttempt } from '../utils/redis';
import { reminderQueue, emailQueue, accountRemovalQueue, forgotPasswordQueue } from '../utils/bull';

// ================================= Start of create user =================================== //
export const createUser = async (data: CreatedUserType, file: Express.Multer.File | undefined) => {
  // Check if a user with this email already exists
  const existingUser = await userDao.getUser({ email: data.email }).select('+accountState');

  if (existingUser) {
    if (existingUser.accountState === ACCOUNT_STATES.DELETED) {
      throw new AppError(
        'This email is no longer allowed to register.',
        RESPONSE_STATUSES.FORBIDDEN,
      );
    }

    throw new AppError('Email already in use.', RESPONSE_STATUSES.BAD_REQUEST);
  }

  let result;

  if (file) {
    // upload to AWS s3 storage
    // const imageUrl = await uploadToS3(file);
    // data.photo = imageUrl;

    // Alternative: upload to cloudinary storage
    result = await uploadToCloudinary(file);
    data.photo = result.secure_url;
  }

  // Create the new user
  const createdUser = await userDao.createUser(data);

  if (!createdUser) {
    throw new AppError('Failed to create user', RESPONSE_STATUSES.SERVER);
  }

  createdUser.signupAt = new Date();
  createdUser.photoPublicId = result.public_id;

  const verificationToken = createdUser.createEmailVerificationToken(
    DURATIONS.EMAIL_VERIFICATION_TOKEN_AGE,
  );

  await createdUser.save({ validateBeforeSave: false });

  try {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?verificationToken=${verificationToken}`;

    await emailQueue.remove(`email-${createdUser._id}`).catch(() => {}); // Clean up job queue first
    await reminderQueue.remove(`reminder-${createdUser._id}`).catch(() => {}); // Clean up job queue first
    await accountRemovalQueue.remove(`removal-${createdUser._id}`).catch(() => {}); // Clean up job queue first

    // send delete account permanently reminder email if user does not activate
    await sendAccountActivationEmail(createdUser, verificationUrl);
    await sendAccountDeletionReminderEmail(
      createdUser,
      DURATIONS.BULL_JOB_ACCOUNT_REMOVAL_AFTER_SIGNUP_WITHOUT_VERIFICATION_PERIOD,
    );
    await sendAccountDeletionEmail(
      createdUser,
      DURATIONS.TIME_TO_DELETE_AFTER_SIGNUP_WITHOUT_ACTIVATION,
    );
  } catch (error) {
    logger.error(`Failed to queue email verification job for user: ${createdUser.email}`, error);
  }
};
// ================================= End of create user =================================== //

// ================================= Start of login user =================================== //
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
  const user = await userDao
    .getUser({ email: userData.email })
    .select('+password +isVerified +deletedAt +accountState +refreshToken');

  if (user?.accountState === ACCOUNT_STATES.DELETED) {
    throw new AppError(
      'This account has been permanently deleted by an administrator.',
      RESPONSE_STATUSES.UNAUTHORIZED,
    );
  }

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

  // Set the reminder job status to pending
  user.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.PENDING;
  user.accountInactivationReminderEmailSentAt = undefined;
  await user.save({ validateBeforeSave: false });

  await clearLoginAttempts(userData.email);

  const refreshTokenValue = generateToken(
    user._id,
    'JWT_REFRESH_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_EXPIRES_IN',
  );

  // Handle Token Rotation
  const newRefreshToken = await rotateRefreshToken(res, jwt, refreshTokenValue, user);

  // Update login/logout times
  user.loginAt = new Date();
  user.logoutAt = undefined;
  await user.save({ validateBeforeSave: false });

  // Generate access token
  const accessToken = generateToken(
    user._id,
    'JWT_ACCESS_TOKEN_SECRET',
    'JWT_ACCESS_TOKEN_EXPIRES_IN',
  );

  const {
    role,
    loginAt,
    password,
    deletedAt,
    isVerified,
    accountState,
    refreshToken,
    photoPublicId,
    accountInactivationReminderEmailSentStatus,
    ...restUserData
  } = user.toObject();

  return { user: restUserData, accessToken, refreshToken: newRefreshToken };
};
// ================================= End of login user =================================== //

// ================================= Start of refresh access token =================================== //
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
  const user = await userDao.getUser({ refreshToken }).select('+refreshToken');
  const newRefreshToken = generateToken(
    payload.data,
    'JWT_REFRESH_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_EXPIRES_IN',
  );

  if (!user) {
    // Token reuse detected
    logger.warn('Refresh token reuse detected!');
    const hackedUser = await userDao.getUserById(payload.data);
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
// ================================= End of refresh access token =================================== //

// ================================= Start of forgot password =================================== //
export const forgotPassword = async (email: string): Promise<void> => {
  const user = await userDao.getUser({ email }).select('+isVerified');

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
  } catch (error) {
    logger.error(`Failed to queue email verification job for user: ${user.email}`, error);
  }
};
// ================================= End of forgot password =================================== //

// ================================= Start of verify reset token =================================== //
export const verifyResetToken = async (resetToken: string) => {
  const hashedToken = hashToken(resetToken);

  const user = await userDao
    .getUser({
      passwordResetToken: hashedToken,
      passwordResetTokenExpires: { $gt: Date.now() },
    })
    .select('+isVerified');

  if (!user) {
    throw new AppError('Invalid token or token expired', RESPONSE_STATUSES.BAD_REQUEST);
  }

  // check user verification status
  userIsVerified(user);

  return;
};
// ================================= End of verify reset token =================================== //

// ================================= Start of reset password =================================== //
export const resetPassword = async (resetToken: string, password: string): Promise<void> => {
  const hashedToken = hashToken(resetToken);

  const user = await userDao
    .getUser({
      passwordResetToken: hashedToken,
      passwordResetTokenExpires: { $gt: Date.now() },
    })
    .select('+isVerified');

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
  await forgotPasswordQueue.remove(`forgot-${user._id}`);
};
// ================================= End of reset password =================================== //

// ================================= Start of verify email =================================== //
export const verifyEmail = async (verificationToken: string): Promise<ServiceResponse> => {
  const hashedToken = hashToken(verificationToken);

  const user = await userDao.getUser({ verifyEmailToken: hashedToken });

  if (!user) {
    return {
      status: RESPONSE_STATUSES.BAD_REQUEST,
      message: 'Invalid token',
    };
  }

  if (user.verifyEmailTokenExpires && user.verifyEmailTokenExpires.getTime() < Date.now()) {
    return {
      status: RESPONSE_STATUSES.BAD_REQUEST,
      message: 'Invalid token or token has expired',
    };
  }

  if (user.isVerified) {
    return {
      status: RESPONSE_STATUSES.SUCCESS,
      message: 'Email is already verified',
    };
  }

  // success block
  try {
    // Mark as verified
    user.isVerified = true;
    user.verifiedAt = new Date();
    user.verifyEmailToken = undefined;
    user.verifyEmailTokenExpires = undefined;
    await user.save();

    // Remove pending jobs
    await emailQueue.remove(`email-${user._id}`);
    await reminderQueue.remove(`reminder-${user._id}`);
    await accountRemovalQueue.remove(`removal-${user._id}`);

    return {
      status: RESPONSE_STATUSES.SUCCESS,
      message: 'Email verified successfully',
    };
  } catch (error) {
    logger.error('Error verifying email:', error);
    return {
      status: RESPONSE_STATUSES.SERVER,
      message: 'An unexpected error occurred during email verification',
    };
  }
};
// ================================= End of verify email =================================== //

// ================================= Start of resend verification token =================================== //
export const resendVerificationToken = async (email: string): Promise<ServiceResponse> => {
  const user = await userDao.getUser({ email }).select('+isVerified');

  if (!user) {
    throw new AppError('No user found with that email', RESPONSE_STATUSES.NOT_FOUND);
  }

  if (user.isVerified) {
    return {
      status: RESPONSE_STATUSES.SUCCESS,
      message: 'Your account is already verified',
    };
  }

  // Optional: rate-limit resend
  if (
    user.accountActivationEmailSentAt &&
    Date.now() - user.accountActivationEmailSentAt.getTime() <
      DURATIONS.RATE_LIMIT_RESEND_TOKEN_COOLDOWN_PERIOD
  ) {
    throw new AppError('Please wait before requesting again', RESPONSE_STATUSES.TOO_MANY_REQUESTS);
  }

  try {
    const verificationToken = user.createEmailVerificationToken(
      DURATIONS.EMAIL_VERIFICATION_TOKEN_AGE,
    );

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?verificationToken=${verificationToken}`;

    user.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.PENDING;
    await user.save({ validateBeforeSave: false });

    await emailQueue.remove(`email-${user._id}`);
    await sendAccountActivationEmail(user, verificationUrl);

    user.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.SUCCESS;
    user.accountActivationEmailSentAt = new Date();
    await user.save({ validateBeforeSave: false });

    return {
      status: RESPONSE_STATUSES.SUCCESS,
      message: 'Please check your email inbox for the activation email',
    };
  } catch (error) {
    logger.error(`Failed to queue email verification job for user: ${user.email}`, error);
    return {
      status: RESPONSE_STATUSES.SERVER,
      message: 'An unexpected error occurred while resending the verification token',
    };
  }
};
// ================================= End of resend verification token =================================== //
