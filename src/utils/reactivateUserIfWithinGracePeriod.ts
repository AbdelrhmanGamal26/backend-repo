import AppError from './appError';
import { UserDocument } from '../@types/userTypes';
import { ACCOUNT_STATES } from '../constants/general';
import RESPONSE_STATUSES from '../constants/responseStatuses';

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

const reactivateUserIfWithinGracePeriod = async (user: UserDocument) => {
  if (user.accountState !== ACCOUNT_STATES.INACTIVE) return;

  const deletedAt = user.deleteAt?.getTime() ?? 0;
  const withinGracePeriod = Date.now() - deletedAt <= THIRTY_DAYS_IN_MS;

  if (!withinGracePeriod) {
    throw new AppError('Account has been deactivated permanently', RESPONSE_STATUSES.NOT_FOUND);
  }

  user.accountState = ACCOUNT_STATES.ACTIVE;
  user.deleteAt = undefined;
  await user.save({ validateBeforeSave: false });
};

export default reactivateUserIfWithinGracePeriod;
