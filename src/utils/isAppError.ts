import AppError from './appError';

function isAppError(error: unknown): error is AppError {
  return (
    error instanceof AppError ||
    (typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      'statusCode' in error &&
      'status' in error &&
      'isOperational' in error)
  );
}

export default isAppError;
