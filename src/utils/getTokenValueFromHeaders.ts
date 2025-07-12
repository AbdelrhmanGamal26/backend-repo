import { Request } from 'express';
import AppError from './appError';
import RESPONSE_STATUSES from '../constants/responseStatuses';

const getTokenValueFromHeaders = (req: Request): string => {
  const authorization = req.headers.authorization;
  let token: string | undefined;

  if (authorization) {
    // If authorization is a string, parse it as needed (e.g., Bearer token)
    if (typeof authorization === 'string') {
      // Example: Bearer <token>
      const parts = authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }
  }

  if (!token) {
    throw new AppError(
      `You are not authorized to perform this action. Please login first then try again.`,
      RESPONSE_STATUSES.UNAUTHORIZED,
    );
  }

  return token;
};

export default getTokenValueFromHeaders;
