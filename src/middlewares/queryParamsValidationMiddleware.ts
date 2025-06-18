import { ZodSchema } from 'zod';
import { NextFunction, Response } from 'express';
import AppError from '../utils/appError';
import catchAsync from '../utils/catchAsync';
import { CustomRequest } from '../@types/generalTypes';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const queryParamsValidationMiddleware = (Schema: ZodSchema) =>
  catchAsync(async (req: CustomRequest, _res: Response, next: NextFunction) => {
    const queryParams = req.query;
    const result = Schema.safeParse(queryParams);

    if (!result.success) throw new AppError('Invalid reset token', RESPONSE_STATUSES.BAD_REQUEST);

    next();
  });
