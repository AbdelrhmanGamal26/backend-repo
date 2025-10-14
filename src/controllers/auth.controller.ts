import { Response } from 'express';
import DURATIONS from '../constants/durations';
import { getQueryParam } from '../utils/generalUtils';
import { CustomRequest } from '../@types/generalTypes';
import * as authServices from '../services/auth.service';
import setValueToCookies from '../utils/setValueToCookies';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const createUser = async (req: CustomRequest, res: Response) => {
  await authServices.createUser(req.body, req.file);
  res.status(RESPONSE_STATUSES.CREATED).json({
    message: 'Please check your email inbox for the account verification email',
    data: null,
  });
};

export const loginUser = async (req: CustomRequest, res: Response) => {
  const jwt = req.cookies?.refreshToken || '';
  const { user, accessToken, refreshToken } = await authServices.login(req.body, res, jwt);
  setValueToCookies(res, 'refreshToken', refreshToken, DURATIONS.REFRESH_TOKEN_MAX_AGE);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'success',
    data: {
      accessToken,
      user,
    },
  });
};

export const refreshAccessToken = async (req: CustomRequest, res: Response) => {
  const newAccessToken = await authServices.refreshAccessToken(res, req.cookies?.refreshToken);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'success',
    data: {
      accessToken: newAccessToken,
    },
  });
};

export const forgotPassword = async (req: CustomRequest, res: Response) => {
  await authServices.forgotPassword(req.body.email);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'Please check your email inbox for the password reset email',
    data: null,
  });
};

export const verifyResetToken = async (req: CustomRequest, res: Response) => {
  const resetToken = getQueryParam(req.query.resetToken);

  if (typeof resetToken !== 'string') {
    return res.status(RESPONSE_STATUSES.BAD_REQUEST).json({
      message: 'Invalid or missing reset token',
      data: null,
    });
  }

  await authServices.verifyResetToken(resetToken);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'Token verified successfully',
    data: null,
  });
};

export const resetPassword = async (req: CustomRequest, res: Response) => {
  const resetToken = getQueryParam(req.query.resetToken);

  if (typeof resetToken !== 'string') {
    return res.status(RESPONSE_STATUSES.BAD_REQUEST).json({
      message: 'Invalid or missing reset token',
      data: null,
    });
  }

  await authServices.resetPassword(resetToken, req.body.password);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    message: 'Password reset successfully',
    data: null,
  });
};

export const verifyEmail = async (req: CustomRequest, res: Response) => {
  const token = getQueryParam(req.query.verificationToken);

  if (typeof token !== 'string') {
    return res.status(RESPONSE_STATUSES.BAD_REQUEST).json({
      message: 'Invalid or missing verification token',
      data: null,
    });
  }

  const { status, message } = await authServices.verifyEmail(token);
  res.status(status).json({
    message,
    data: null,
  });
};

export const resendVerificationToken = async (req: CustomRequest, res: Response) => {
  const { status, message } = await authServices.resendVerificationToken(req.body.email);
  res.status(status).json({
    message,
    data: null,
  });
};
