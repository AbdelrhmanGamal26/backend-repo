import AppError from './appError';
import { UserDocument } from '../@types/userTypes';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const userIsVerified = (user: UserDocument) => {
  if (!user.isVerified) {
    throw new AppError(
      'Email is not verified yet. Please check your email inbox for the verification link and try again.',
      RESPONSE_STATUSES.BAD_REQUEST,
    );
  }
};
