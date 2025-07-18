import { Types } from 'mongoose';
import { Response } from 'express';
import {
  forgotPasswordEmailTemplate,
  emailVerificationEmailTemplate,
} from '../constants/emailTemplates';
import AppError from '../utils/appError';
import sendEmail from '../utils/nodemailer';
import User from '../db/schemas/user.schema';
import DURATIONS from '../constants/durations';
import { hashToken } from '../utils/generalUtils';
import { userIsVerified } from '../utils/userUtils';
import clearCookieValue from '../utils/clearCookieValue';
import { generateToken, verifyToken } from '../utils/jwt';
import setValueToCookies from '../utils/setValueToCookies';
import rotateRefreshToken from '../utils/rotateRefreshToken';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { accountQueue, emailQueue, getBullJobSettings } from '../utils/bull';
import handlebarsEmailTemplateCompiler from '../utils/handlebarsEmailTemplateCompiler';
import { BULL_ACCOUNT_JOB_NAME, EMAIL_VERIFICATION_STATUSES } from '../constants/general';
import reactivateUserIfWithinGracePeriod from '../utils/reactivateUserIfWithinGracePeriod';
import { checkLoginAttempts, clearLoginAttempts, recordFailedAttempt } from '../utils/redis';

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
  createdUser.timeToDeleteAfterSignupWithoutActivation = new Date(
    Date.now() + DURATIONS.TIME_TO_DELETE_AFTER_SIGNUP_WITHOUT_ACTIVATION,
  );
  const verificationToken = createdUser.createEmailVerificationToken(
    DURATIONS.EMAIL_VERIFICATION_TOKEN_AGE,
  );
  await createdUser.save({
    validateBeforeSave: false,
  });

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?verificationToken=${verificationToken}`;

  try {
    await emailQueue.remove(`email-${createdUser._id}`); // Clean up job queue first
    await accountQueue.remove(`reminder-${createdUser._id}`); // Clean up job queue first
    await emailQueue.add(
      BULL_ACCOUNT_JOB_NAME.SEND_EMAIL_VERIFICATION,
      {
        userData: {
          email: createdUser.email,
          name: createdUser.name,
        },
        verificationUrl,
        userId: createdUser._id,
      },
      getBullJobSettings(
        DURATIONS.SEND_EMAIL_VERIFICATION_DELAY_PERIOD,
        `email-${createdUser._id}`,
      ),
    );

    // send delete account permanently reminder email if user does not activate
    await accountQueue.add(
      BULL_ACCOUNT_JOB_NAME.SEND_REMINDER,
      {
        userData: {
          email: createdUser.email,
          name: createdUser.name,
        },
        userId: createdUser._id,
      },
      getBullJobSettings(DURATIONS.EMAIL_REMINDER_DELAY_PERIOD, `reminder-${createdUser._id}`),
    );
  } catch (err) {
    createdUser.verifyEmailToken = undefined;
    createdUser.verifyEmailTokenExpires = undefined;
    await createdUser.save({ validateBeforeSave: false });
    throw new AppError('Failed to send email', RESPONSE_STATUSES.SERVER);
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

  // Remove any account deletion reminder job
  await accountQueue.remove(`reminder-${user._id}`);

  const isPasswordCorrect = await user.correctPassword(userData.password);

  if (!isPasswordCorrect) {
    await recordFailedAttempt(userData.email);
    throw new AppError('Incorrect email or password', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  // Reactivate user account if it's inactive and still within reactivation grace period
  await reactivateUserIfWithinGracePeriod(user);

  await clearLoginAttempts(userData.email);

  const refreshTokenValue = generateToken(
    user._id,
    'JWT_REFRESH_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_EXPIRES_IN',
  );

  // Handle Token Rotation
  const newRefreshTokenArray = await rotateRefreshToken(res, jwt, refreshTokenValue, user, User);

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
    throw new AppError('Refresh token missing', RESPONSE_STATUSES.UNAUTHORIZED);
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
    console.warn('Refresh token reuse detected!');
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

  const resetURL = `${process.env.FRONTEND_URL}/reset-password?resetToken=${resetToken}`;
  const message = handlebarsEmailTemplateCompiler(forgotPasswordEmailTemplate, {
    name: user.name,
    resetURL,
  });

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 minutes)',
      message,
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new AppError('Failed to send email', RESPONSE_STATUSES.SERVER);
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
  user.timeToDeleteAfterSignupWithoutActivation = undefined;
  await user.save();

  await emailQueue.remove(`email-${user._id}`);
  await accountQueue.remove(`reminder-${user._id}`);

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

  await emailQueue.remove(`email-${user._id}`);

  const verificationToken = user.createEmailVerificationToken(
    DURATIONS.RESENT_EMAIL_VERIFICATION_TOKEN_AGE,
  );
  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?verificationToken=${verificationToken}`;
  const verificationMessage = handlebarsEmailTemplateCompiler(emailVerificationEmailTemplate, {
    name: user.name,
    verificationUrl,
  });

  try {
    await sendEmail({
      email: user.email,
      subject: 'email verification token (valid for 10 minutes)',
      message: verificationMessage,
    });
  } catch (err) {
    user.verifyEmailToken = undefined;
    user.verifyEmailTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });

    throw new AppError('Failed to send email', RESPONSE_STATUSES.SERVER);
  }
};
