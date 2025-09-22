import { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import AppError from '../utils/appError';
import { verifyToken } from '../utils/jwt';
import * as userDao from '../DAOs/user.dao';
import catchAsync from '../utils/catchAsync';
import { CustomRequest } from '../@types/generalTypes';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import getTokenValueFromCookies from '../utils/getTokenValueFromCookies';

const authenticatedMiddleware = catchAsync(
  async (req: CustomRequest, _res: Response, next: NextFunction) => {
    const token =
      req.headers.authorization?.split(' ')[1] || getTokenValueFromCookies(req, 'accessToken');

    if (!token) {
      return next(
        new AppError(
          'You are not logged in. Please login first to access this route',
          RESPONSE_STATUSES.UNAUTHORIZED,
        ),
      );
    }

    const decoded = verifyToken(token, 'JWT_ACCESS_TOKEN_SECRET');

    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !('iat' in decoded) ||
      typeof decoded.data !== 'string'
    ) {
      return next(new AppError('Invalid token', RESPONSE_STATUSES.UNAUTHORIZED));
    }

    const userId = new Types.ObjectId(decoded.data);

    const currentUser = await userDao.getUserById(userId);

    if (!currentUser) {
      return next(
        new AppError(
          'You are not logged in or no user found with that ID. Try logging in again',
          RESPONSE_STATUSES.UNAUTHORIZED,
        ),
      );
    }

    if (
      typeof currentUser.changedPasswordAfter === 'function' &&
      currentUser.changedPasswordAfter(decoded.iat as number)
    ) {
      return next(
        new AppError(
          'User password has been changed after token was issued. Please login again.',
          RESPONSE_STATUSES.UNAUTHORIZED,
        ),
      );
    }

    req.user = currentUser;
    next();
  },
);

export default authenticatedMiddleware;
