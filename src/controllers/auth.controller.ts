import { Response } from 'express';
import { CustomRequest } from '../@types/generalTypes';
import * as authServices from '../services/auth.service';
import setValueToCookies from '../utils/setValueToCookies';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { EMAIL_VERIFICATION_STATUSES } from '../constants/general';

export const createUser = async (req: CustomRequest, res: Response) => {
  await authServices.createUser(req.body);
  res.status(RESPONSE_STATUSES.CREATED).json({
    message: 'check your email inbox for the account verification email',
  });
};

export const loginUser = async (req: CustomRequest, res: Response) => {
  const { user, accessToken } = await authServices.login(req.body);
  setValueToCookies(res, 'jwt', accessToken);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      accessToken,
      user,
    },
  });
};

export const forgotPassword = async (req: CustomRequest, res: Response) => {
  await authServices.forgotPassword(req.body.email);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'Please check your email inbox for the password reset email',
  });
};

export const verifyResetToken = async (req: CustomRequest, res: Response) => {
  const resetToken = Array.isArray(req.query.resetToken)
    ? req.query.resetToken[0]
    : req.query.resetToken;
  if (typeof resetToken !== 'string') {
    return res.status(RESPONSE_STATUSES.BAD_REQUEST).json({
      message: 'Invalid or missing reset token',
    });
  }
  await authServices.verifyResetToken(resetToken);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'Token verified successfully',
  });
};

export const resetPassword = async (req: CustomRequest, res: Response) => {
  const resetToken = Array.isArray(req.query.resetToken)
    ? req.query.resetToken[0]
    : req.query.resetToken;
  if (typeof resetToken !== 'string') {
    return res.status(RESPONSE_STATUSES.BAD_REQUEST).json({
      message: 'Invalid or missing reset token',
    });
  }
  await authServices.resetPassword(resetToken, req.body.password);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'Password reset successfully',
  });
};

export const verifyEmail = async (req: CustomRequest, res: Response) => {
  const token = Array.isArray(req.query.verificationToken)
    ? req.query.verificationToken[0]
    : req.query.verificationToken;

  if (typeof token !== 'string') {
    return res.status(RESPONSE_STATUSES.BAD_REQUEST).json({
      message: 'Invalid or missing verification token',
    });
  }

  const verificationStatus = await authServices.verifyEmail(token);

  switch (verificationStatus) {
    case EMAIL_VERIFICATION_STATUSES.INVALID:
    case EMAIL_VERIFICATION_STATUSES.INVALID_OR_EXPIRED:
      return res.status(RESPONSE_STATUSES.BAD_REQUEST).json({
        message: 'Invalid token or token has expired',
      });
    case EMAIL_VERIFICATION_STATUSES.ALREADY_VERIFIED:
      return res.status(RESPONSE_STATUSES.SUCCESS).json({
        message: 'Email already verified',
      });
    case EMAIL_VERIFICATION_STATUSES.VERIFIED:
      return res.status(RESPONSE_STATUSES.FOUND).json({
        message: 'Email verified successfully',
      });
    default:
      return res.status(RESPONSE_STATUSES.SERVER).json({
        message: 'An unexpected error occurred',
      });
  }
};

export const resendVerificationToken = async (req: CustomRequest, res: Response) => {
  const status = await authServices.resendVerificationToken(req.body.email);

  if (status === EMAIL_VERIFICATION_STATUSES.ALREADY_VERIFIED) {
    return res.status(RESPONSE_STATUSES.SUCCESS).json({
      message: 'Your account is already verified',
    });
  }

  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'Please check your email inbox for the activation email',
  });
};
