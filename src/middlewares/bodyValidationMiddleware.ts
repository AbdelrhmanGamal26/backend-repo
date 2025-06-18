import { z } from 'zod';
import { NextFunction, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { CustomRequest } from './../@types/generalTypes';
import validateSchema from '../validations/validateSchema';

const bodyValidationMiddleware = (Schema: z.Schema) =>
  catchAsync(async (req: CustomRequest, _res: Response, next: NextFunction) => {
    const validatedData = validateSchema({ Schema, data: req.body });
    req.body = validatedData;
    next();
  });

export default bodyValidationMiddleware;
