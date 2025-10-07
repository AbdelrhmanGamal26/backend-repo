import { Response } from 'express';
import DURATIONS from '../constants/durations';
import { getQueryParam } from '../utils/generalUtils';
import { CustomRequest } from '../@types/generalTypes';
import * as authServices from '../services/auth.service';
import setValueToCookies from '../utils/setValueToCookies';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const createUser = async (req: CustomRequest, res: Response) => {
  await authServices.createUser(req.body);
  res.status(RESPONSE_STATUSES.CREATED).json({
    message: 'Please check your email inbox for the account verification email',
  });
};

export const loginUser = async (req: CustomRequest, res: Response) => {
  const jwt = req.cookies?.refreshToken || '';
  const { user, accessToken, refreshToken } = await authServices.login(req.body, res, jwt);
  setValueToCookies(res, 'refreshToken', refreshToken, DURATIONS.REFRESH_TOKEN_MAX_AGE);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      accessToken,
      user,
    },
  });
};

export const refreshAccessToken = async (req: CustomRequest, res: Response) => {
  const newAccessToken = await authServices.refreshAccessToken(res, req.cookies?.refreshToken);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      accessToken: newAccessToken,
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
  const resetToken = getQueryParam(req.query.resetToken);

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
  const resetToken = getQueryParam(req.query.resetToken);

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
  const token = getQueryParam(req.query.verificationToken);

  if (typeof token !== 'string') {
    return res.status(RESPONSE_STATUSES.BAD_REQUEST).json({
      message: 'Invalid or missing verification token',
    });
  }

  const { status, message } = await authServices.verifyEmail(token);

  res.status(status).json({
    message,
  });
};

export const resendVerificationToken = async (req: CustomRequest, res: Response) => {
  const { status, message } = await authServices.resendVerificationToken(req.body.email);

  res.status(status).json({
    message,
  });
};
