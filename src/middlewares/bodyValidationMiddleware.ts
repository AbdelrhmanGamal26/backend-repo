import { NextFunction, Response } from 'express';
import { z } from 'zod';
import catchAsync from '../utils/catchAsync';
import { CustomRequest } from './../@types/generalTypes';
import validateSchema from '../validations/validateSchema';

const bodyValidationMiddleware = (Schema: z.Schema) =>
  catchAsync(async (req: CustomRequest, _res: Response, next: NextFunction) => {
    const data = { ...req.body, photo: req.file?.filename };

    validateSchema({ Schema, data });

    next();
  });

export default bodyValidationMiddleware;
