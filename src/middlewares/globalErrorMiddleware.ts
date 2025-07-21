import { Request, Response, NextFunction } from 'express';
import logger from '../utils/winston';
import AppError from '../utils/appError';
import { wrapError } from '../utils/wrapError';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { isDevelopment, isProduction } from '../utils/generalUtils';

// --- DEV/PROD SENDERS (no change needed) ---
const sendErrorDev = (err: AppError, res: Response) => {
  return res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: AppError, res: Response) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
  logger.error(`error: ${err}`);
  return res.status(RESPONSE_STATUSES.SERVER).json({
    status: 'error',
    message: 'Something went very wrong!',
  });
};

const globalErrorHandler = (err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  const error = wrapError(err);

  if (isDevelopment) {
    sendErrorDev(error, res);
  } else if (isProduction) {
    sendErrorProd(error, res);
  }
};

export default globalErrorHandler;
