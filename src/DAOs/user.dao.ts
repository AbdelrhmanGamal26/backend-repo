import { Types } from 'mongoose';
import User from '../db/schemas/user.schema';
import { ACCOUNT_STATES } from '../constants/general';
import { CreatedUserType } from './../@types/userTypes';

export const createUser = (data: CreatedUserType) => {
  return User.create(data);
};

export const getUser = (data: { [key: string]: any }) => {
  return User.findOne(data);
};

export const getUserById = (userId: Types.ObjectId) => {
  return User.findById(userId);
};

export const getAllUsers = (params: {
  page?: string;
  limit?: string;
  sort?: string;
  [key: string]: any;
}) => {
  const { page, limit, sort, ...paramsObj } = params;
  return User.find(paramsObj).lean();
};

export const getAllActiveUsers = async (params: {
  page?: string;
  limit?: string;
  sort?: string;
  [key: string]: any;
}) => {
  const { page, limit, sort, ...paramsObj } = params;
  return User.find({
    ...paramsObj,
    accountState: ACCOUNT_STATES.ACTIVE,
  }).lean();
};

export const updateUserData = (
  queryFilter: { [key: string]: any },
  userData: { [key: string]: any },
  optionsObj?: { new: boolean; runValidators: boolean },
) => {
  return User.findOneAndUpdate(queryFilter, userData, optionsObj);
};

export const deleteUserById = (userId: string) => {
  return User.findByIdAndDelete(userId);
};
