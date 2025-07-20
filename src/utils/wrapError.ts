import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import logger from './winston';
import AppError from './appError';
import isMongoDuplicateError from './isMongoDuplicateError';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export function wrapError(err: unknown): AppError {
  // 1. Already an AppError
  if (err instanceof AppError) {
    return err;
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const flattened = err.flatten();
    const firstErrorMessage = Object.values(flattened.fieldErrors)[0]?.[0] ?? 'Validation failed';
    const detail = JSON.stringify(err.flatten());
    return new AppError(
      firstErrorMessage,
      RESPONSE_STATUSES.BAD_REQUEST,
      'ZOD_VALIDATION_ERROR',
      detail,
    );
  }

  // 3. Mongoose Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    const message = err.message || 'Mongoose validation error';
    const detail = JSON.stringify(err.errors);
    return new AppError(
      message,
      RESPONSE_STATUSES.BAD_REQUEST,
      'MONGOOSE_VALIDATION_ERROR',
      detail,
    );
  }

  // 4. MongoDB Duplicate Key Error
  if (isMongoDuplicateError(err)) {
    const value = err.errmsg.match(/(["'])((?:\\\1|.)*?)\1/g);
    const message = `Duplicate key error: ${value}. Please choose another value`;
    const detail = 'A unique field already exists.';
    return new AppError(message, RESPONSE_STATUSES.BAD_REQUEST, String(err.code), detail);
  }

  // 5. JWT Expiration Error
  if (err instanceof TokenExpiredError) {
    const message = `${err.message} at: ${err.expiredAt}`;
    const detail = err.name;

    return new AppError(message, RESPONSE_STATUSES.UNAUTHORIZED, err.name, detail);
  }

  // 6. Invalid JWT Error
  if (err instanceof JsonWebTokenError) {
    const message = 'Invalid token. Please login again!';
    const detail = err.message;

    return new AppError(message, RESPONSE_STATUSES.UNAUTHORIZED, err.name, detail);
  }

  // 7. Generic Error
  if (err instanceof Error) {
    logger.error(err.message);
    return new AppError(err.message, RESPONSE_STATUSES.SERVER);
  }

  // 8. Unknown (string, number, object)
  const message =
    typeof err === 'string'
      ? err
      : typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof err.message === 'string'
        ? err.message
        : 'Unknown error occurred';

  const detail = typeof err === 'object' ? JSON.stringify(err) : String(err);

  return new AppError(message, RESPONSE_STATUSES.SERVER, 'UNKNOWN', detail);
}
