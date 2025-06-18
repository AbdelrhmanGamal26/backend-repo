import { Response } from 'express';
import { CustomRequest } from '../@types/generalTypes';
import * as authServices from '../services/auth.service';
import setValueToCookies from '../utils/setValueToCookies';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { EMAIL_VERIFICATION_STATUSES } from '../constants/general';

export const createUser = async (req: CustomRequest, res: Response) => {
  const user = await authServices.createUser(req);
  res.status(RESPONSE_STATUSES.CREATED).json({
    status: 'Success',
    message: 'check your email inbox for the email verification link',
    data: {
      user,
    },
  });
};

export const loginUser = async (req: CustomRequest, res: Response) => {
  const { user, accessToken } = await authServices.login(req.body);
  const { password, isVerified, loginAt, ...restUserData } = user.toObject();
  setValueToCookies(res, 'jwt', accessToken);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    status: 'Success',
    data: {
      accessToken,
      user: restUserData,
    },
  });
};

export const forgotPassword = async (req: CustomRequest, res: Response) => {
  await authServices.forgotPassword(req);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    status: 'Success',
    message: 'Token sent to email',
  });
};

export const resetPassword = async (req: CustomRequest, res: Response) => {
  const token = await authServices.resetPassword(req);
  setValueToCookies(res, 'jwt', token);
  res.status(RESPONSE_STATUSES.SUCCESS).json({
    status: 'Success',
    data: {
      accessToken: token,
    },
  });
};

export const verifyEmailToken = async (req: CustomRequest, res: Response) => {
  const status = await authServices.verifyEmailToken(req);
  if (
    status === EMAIL_VERIFICATION_STATUSES.INVALID ||
    status === EMAIL_VERIFICATION_STATUSES.INVALID_OR_EXPIRED
  ) {
    return res
      .status(RESPONSE_STATUSES.BAD_REQUEST)
      .redirect(`${process.env.FRONTEND_URL}/verifyEmail?status=${status}`);
  } else if (
    status === EMAIL_VERIFICATION_STATUSES.VERIFIED ||
    status === EMAIL_VERIFICATION_STATUSES.ALREADY_VERIFIED
  ) {
    return res
      .status(RESPONSE_STATUSES.FOUND)
      .redirect(`${process.env.FRONTEND_URL}/verifyEmail?status=${status}`);
  }
};

export const resendVerificationToken = async (req: CustomRequest, res: Response) => {
  const status = await authServices.resendVerificationToken(req);

  if (status === EMAIL_VERIFICATION_STATUSES.ALREADY_VERIFIED) {
    return res
      .status(RESPONSE_STATUSES.SUCCESS)
      .redirect(`${process.env.FRONTEND_URL}/verifyEmail?status=${status}`);
  }

  res.status(RESPONSE_STATUSES.SUCCESS).json({
    status: 'Success',
    message: 'Token sent to email',
  });
};
