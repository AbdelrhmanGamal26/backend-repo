import AppError from '../utils/appError';
import User from '../db/schemas/user.schema';
import { UserDocument } from './../@types/userTypes';
import { ACCOUNT_STATES } from '../constants/general';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const getUser = async (userId: string): Promise<UserDocument> => {
  const user: UserDocument | null = await User.findById(userId).lean();

  if (!user) {
    throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  return user;
};

export const getAllUsers = async (params: {
  page?: string;
  limit?: string;
  sort?: string;
  [key: string]: any;
}) => {
  const { page, limit, sort, ...paramsObj } = params;
  const users: UserDocument[] = await User.find(paramsObj).lean();
  return users;
};

export const getAllActiveUsers = async (params: {
  page?: string;
  limit?: string;
  sort?: string;
  [key: string]: any;
}) => {
  const { page, limit, sort, ...paramsObj } = params;
  const users: UserDocument[] = await User.find({
    ...paramsObj,
    accountState: ACCOUNT_STATES.ACTIVE,
  }).lean();
  return users;
};
