import AppError from './appError';
import { CustomRequest } from '../@types/generalTypes';
import RESPONSE_STATUSES from '../constants/responseStatuses';

const getTokenValue = (req: CustomRequest, cookieName: string): string => {
  const token = req.cookies?.[cookieName];

  if (!token) {
    throw new AppError(
      `You are not authorized to perform this action. Please login first then try again.`,
      RESPONSE_STATUSES.UNAUTHORIZED,
    );
  }

  return token;
};

export default getTokenValue;
