import AppError from './appError';
import DURATIONS from '../constants/durations';
import { UserDocument } from '../@types/userTypes';
import { ACCOUNT_STATES } from '../constants/general';
import RESPONSE_STATUSES from '../constants/responseStatuses';

const reactivateUserIfWithinGracePeriod = async (user: UserDocument) => {
  if (user.accountState !== ACCOUNT_STATES.INACTIVE) return;

  const deletedAt = user.deletedAt?.getTime() ?? 0;
  const withinGracePeriod =
    Date.now() - deletedAt <= DURATIONS.ACCOUNT_REACTIVATION_AFTER_SOFT_DELETE_GRACE_PERIOD;

  if (!withinGracePeriod) {
    throw new AppError('Account has been deactivated permanently', RESPONSE_STATUSES.NOT_FOUND);
  }

  user.accountState = ACCOUNT_STATES.ACTIVE;
  user.deletedAt = undefined;
  await user.save({ validateBeforeSave: false });
};

export default reactivateUserIfWithinGracePeriod;
