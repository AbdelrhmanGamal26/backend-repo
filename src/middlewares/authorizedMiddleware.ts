import { NextFunction, Response } from 'express';
import AppError from '../utils/appError';
import { CustomRequest } from '../@types/generalTypes';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const authorizedMiddleware =
  (...roles: string[]) =>
  (req: CustomRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          'You do not have the permission to do this action',
          RESPONSE_STATUSES.FORBIDDEN
        )
      );
    }

    next();
  };
