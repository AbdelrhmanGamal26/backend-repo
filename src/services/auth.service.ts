import crypto from 'crypto';
import {
  ACCOUNT_STATES,
  BULL_ACCOUNT_JOB_NAME,
  EMAIL_VERIFICATION_STATUSES,
} from '../constants/general';
import sendEmail from '../utils/email';
import AppError from '../utils/appError';
import User from '../db/schemas/user.schema';
import { generateToken } from '../utils/jwt';
import { accountQueue } from '../utils/bull';
import { UserDocument } from './../@types/userTypes';
import { CustomRequest } from '../@types/generalTypes';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { checkLoginAttempts, clearLoginAttempts, recordFailedAttempt } from '../utils/redis';

export const createUser = async (req: CustomRequest) => {
  const createdUser = await User.create(req.body);

  if (!createdUser) {
    throw new AppError('Failed to create user', RESPONSE_STATUSES.SERVER);
  }

  const verificationToken = createdUser.createEmailVerificationToken(60 * 60 * 1000);
  createdUser.signupAt = new Date();
  createdUser.timeToDeleteAfterSignupWithoutActivation = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000,
  );
  await createdUser.save({
    validateBeforeSave: false,
  });

  const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verifyEmail?verificationToken=${verificationToken}`;

  try {
    await accountQueue.remove(`email-${createdUser._id}`); // Clean up first

    await accountQueue.add(
      BULL_ACCOUNT_JOB_NAME.SEND_EMAIL_VERIFICATION,
      { userData: { email: createdUser.email, name: createdUser.name }, verificationUrl },
      { delay: 5000, jobId: `email-${createdUser._id}` },
    );

    await accountQueue.add(
      BULL_ACCOUNT_JOB_NAME.SEND_REMINDER,
      { email: createdUser.email, name: createdUser.name },
      {
        delay: 3 * 24 * 60 * 60 * 1000,
        jobId: `reminder-${createdUser._id}`,
      },
    );
  } catch (err) {
    createdUser.verifyEmailToken = undefined;
    createdUser.verifyEmailTokenExpires = undefined;
    await createdUser.save({ validateBeforeSave: false });
    throw new AppError('Failed to send email', RESPONSE_STATUSES.SERVER);
  }

  const {
    signupAt,
    password,
    isVerified,
    accountState,
    verifyEmailToken,
    verifyEmailTokenExpires,
    timeToDeleteAfterSignupWithoutActivation,
    ...sanitizedUser
  } = createdUser.toObject();

  return sanitizedUser;
};

export const login = async (userData: {
  email: string;
  password: string;
}): Promise<{ user: UserDocument; accessToken: string }> => {
  const user = await User.findOne({
    email: userData.email,
  }).select('+password +isVerified');

  if (!user) {
    await recordFailedAttempt(userData.email);
    await new Promise((res) => setTimeout(res, 300)); // Timing normalization
    throw new AppError('Incorrect email or password', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  if (!user.isVerified) {
    throw new AppError(
      'Email is not verified yet. Please check your email inbox for the verification link and try again.',
      RESPONSE_STATUSES.BAD_REQUEST,
    );
  }

  // Store the login attempt
  await checkLoginAttempts(userData.email);

  // Remove any account deletion reminder job
  await accountQueue.remove(`reminder-${user._id}`);

  const isPasswordCorrect = await user.correctPassword(userData.password);

  if (!isPasswordCorrect) {
    await recordFailedAttempt(userData.email);
    throw new AppError('Incorrect email or password', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  // Reactivate user account if it's inactive
  const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const lastLogin = user.loginAt?.getTime() ?? 0;

  if (user.accountState === ACCOUNT_STATES.INACTIVE) {
    if (lastLogin >= THIRTY_DAYS_AGO) {
      user.accountState = ACCOUNT_STATES.ACTIVE;
    } else {
      throw new AppError('Account has been deactivated', RESPONSE_STATUSES.NOT_FOUND);
    }
  }

  await clearLoginAttempts(userData.email);

  user.loginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const accessToken = generateToken(user._id);

  return { user, accessToken };
};

export const forgotPassword = async (req: CustomRequest): Promise<void> => {
  const user = await User.findOne({ email: req.body.email }).select('+isVerified');

  if (!user) {
    throw new AppError('No user found with that email', RESPONSE_STATUSES.NOT_FOUND);
  }

  if (!user.isVerified) {
    throw new AppError(
      'Email is not verified yet. Please check your email inbox for the verification link and try again.',
      RESPONSE_STATUSES.BAD_REQUEST,
    );
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `${req.protocol}://${req.get('host')}/api/v1/auth/resetPassword?resetToken=${resetToken}`;
  const message = `Forgot your password? Submit a Patch request with your new password and passwordConfirm to: ${resetURL}.
  \n if you didn't forget your password, please ignore this email.`;

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

export const resetPassword = async (req: CustomRequest): Promise<string> => {
  const { resetToken } = req.query;

  if (!resetToken || typeof resetToken !== 'string') {
    throw new AppError('Invalid token or token expired', RESPONSE_STATUSES.BAD_REQUEST);
  }

  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetTokenExpires: { $gt: Date.now() },
  }).select('+isVerified');

  if (!user) {
    throw new AppError('Invalid token or token expired', RESPONSE_STATUSES.BAD_REQUEST);
  }

  if (!user.isVerified) {
    throw new AppError(
      'Email is not verified yet. Please check your email inbox for the verification link and try again.',
      RESPONSE_STATUSES.BAD_REQUEST,
    );
  }

  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpires = undefined;
  await user.save();

  return generateToken(user._id);
};

export const verifyEmailToken = async (req: CustomRequest): Promise<string> => {
  const { verificationToken } = req.query;

  if (!verificationToken || typeof verificationToken !== 'string') {
    return EMAIL_VERIFICATION_STATUSES.INVALID;
  }

  const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

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

  await accountQueue.remove(`reminder-${user._id}`);

  return EMAIL_VERIFICATION_STATUSES.VERIFIED;
};

export const resendVerificationToken = async (req: CustomRequest): Promise<string | void> => {
  const user = await User.findOne({ email: req.body.email }).select('+isVerified');

  if (!user) {
    throw new AppError('No user found with that email', RESPONSE_STATUSES.NOT_FOUND);
  }

  if (user.isVerified) {
    return EMAIL_VERIFICATION_STATUSES.ALREADY_VERIFIED;
  }

  const verificationToken = user.createEmailVerificationToken(10 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/verifyEmail?verificationToken=${verificationToken}`;
  const verificationMessage = `Hi ${user.name},

    Thanks for signing up! Please confirm your email by clicking the link below:

    ${verificationUrl}

    If you didn't create this account, you can safely ignore this message.

    — The Team`;

  try {
    sendEmail({
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
