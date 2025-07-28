import { Types } from 'mongoose';
import AppError from '../utils/appError';
import User from '../db/schemas/user.schema';
import * as conversationDao from '../DAOs/conversation.dao';
import Conversation from '../db/schemas/conversation.schema';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const getAllUserConversations = async (userId: Types.ObjectId) => {
  const conversations = await conversationDao.getAllUserConversations(userId);

  return conversations;
};

export const startNewConversation = async (currentUserId: Types.ObjectId, email: string) => {
  const recipientUser = await User.findOne({ email });

  if (!recipientUser) {
    throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  const members = [currentUserId.toString(), recipientUser._id.toString()];
  const roomId =
    members[0] < members[1] ? `${members[0]}-${members[1]}` : `${members[1]}-${members[0]}`;

  let conversation = await conversationDao.getConversation(roomId);

  if (!conversation) {
    conversation = await Conversation.create({
      roomId,
      members,
    });
  }

  return conversation;
};

export const deleteConversation = async () => {
  console.log('conversation deleted');
};
