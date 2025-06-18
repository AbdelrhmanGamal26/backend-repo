import { ZodSchema } from 'zod';
import { NextFunction, Response } from 'express';
import AppError from '../utils/appError';
import catchAsync from '../utils/catchAsync';
import { CustomRequest } from '../@types/generalTypes';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const paramsValidationMiddleware = (Schema: ZodSchema) =>
  catchAsync(async (req: CustomRequest, _response: Response, next: NextFunction) => {
    const params = req.params;
    const result = Schema.safeParse(params);

    if (!result.success) throw new AppError('Invalid reset token', RESPONSE_STATUSES.BAD_REQUEST);

    next();
  });
