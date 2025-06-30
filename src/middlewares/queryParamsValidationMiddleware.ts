import { NextFunction, Response } from 'express';
import { ZodSchema } from 'zod';
import AppError from '../utils/appError';
import catchAsync from '../utils/catchAsync';
import { CustomRequest } from '../@types/generalTypes';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const queryParamsValidationMiddleware = (Schema: ZodSchema, message: string) =>
  catchAsync(async (req: CustomRequest, _res: Response, next: NextFunction) => {
    const queryParams = req.query;
    const result = Schema.safeParse(queryParams);

    if (!result.success) throw new AppError(message, RESPONSE_STATUSES.BAD_REQUEST);

    next();
  });
