import { Types } from 'mongoose';
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
import RESPONSE_STATUSES from '../constants/responseStatuses';
import {
  emailVerificationEmailTemplate,
  forgotPasswordEmailTemplate,
} from '../constants/emailTemplates';
import handlebarsEmailTemplateCompiler from '../utils/handlebarsEmailTemplateCompiler';
import { checkLoginAttempts, clearLoginAttempts, recordFailedAttempt } from '../utils/redis';
import { userIsVerified } from '../utils/userUtils';
import { hashToken } from '../utils/generalUtils';

interface CreatedUserType {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const createUser = async (
  data: CreatedUserType,
  protocol: string,
  get: (name: string) => string,
) => {
  const createdUser = await User.create(data);

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

  const verificationUrl = `${protocol}://${get('host')}/api/v1/auth/verify-email?verificationToken=${verificationToken}`;

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
};

interface UserLoginReturnDataType {
  _id: Types.ObjectId;
  __v: number;
  name: string;
  email: string;
  role: string;
}

export const login = async (userData: {
  email: string;
  password: string;
}): Promise<{ user: UserLoginReturnDataType; accessToken: string }> => {
  const user = await User.findOne({
    email: userData.email,
  }).select('+password +isVerified +deleteAt +accountState');

  if (!user) {
    await recordFailedAttempt(userData.email);
    await new Promise((res) => setTimeout(res, 300)); // Timing normalization
    throw new AppError('Incorrect email or password', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  // check user verification status
  userIsVerified(user);

  // Store the login attempt
  await checkLoginAttempts(userData.email);

  // Remove any account deletion reminder job
  await accountQueue.remove(`reminder-${user._id}`);

  const isPasswordCorrect = await user.correctPassword(userData.password);

  if (!isPasswordCorrect) {
    await recordFailedAttempt(userData.email);
    throw new AppError('Incorrect email or password', RESPONSE_STATUSES.UNAUTHORIZED);
  }

  // Reactivate user account if it's inactive and still within reactivation grace period
  const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

  const inactiveSince = user.deleteAt?.getTime() ?? 0;
  const withinGracePeriod = Date.now() - inactiveSince <= THIRTY_DAYS_IN_MS;

  if (user.accountState === ACCOUNT_STATES.INACTIVE) {
    if (withinGracePeriod) {
      user.accountState = ACCOUNT_STATES.ACTIVE;
      user.deleteAt = undefined;
      await user.save({ validateBeforeSave: false });
    } else {
      throw new AppError('Account has been deactivated permanently', RESPONSE_STATUSES.NOT_FOUND);
    }
  }

  await clearLoginAttempts(userData.email);

  user.loginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const accessToken = generateToken(user._id);

  const { password, isVerified, loginAt, deleteAt, accountState, ...restUserData } =
    user.toObject();

  return { user: restUserData, accessToken };
};

export const forgotPassword = async (
  email: string,
  protocol: string,
  get: (name: string) => string,
): Promise<void> => {
  const user = await User.findOne({ email }).select('+isVerified');

  if (!user) {
    throw new AppError('No user found with that email', RESPONSE_STATUSES.NOT_FOUND);
  }

  // check user verification status
  userIsVerified(user);

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `${protocol}://${get('host')}/api/v1/auth/reset-password?resetToken=${resetToken}`;
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

export const verifyEmailToken = async (verificationToken: string): Promise<string> => {
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

  await accountQueue.remove(`reminder-${user._id}`);

  return EMAIL_VERIFICATION_STATUSES.VERIFIED;
};

export const resendVerificationToken = async (
  email: string,
  protocol: string,
  get: (name: string) => string,
): Promise<string | void> => {
  const user = await User.findOne({ email }).select('+isVerified');

  if (!user) {
    throw new AppError('No user found with that email', RESPONSE_STATUSES.NOT_FOUND);
  }

  if (user.isVerified) {
    return EMAIL_VERIFICATION_STATUSES.ALREADY_VERIFIED;
  }

  const verificationToken = user.createEmailVerificationToken(10 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${protocol}://${get('host')}/api/v1/verify-email?verificationToken=${verificationToken}`;
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
