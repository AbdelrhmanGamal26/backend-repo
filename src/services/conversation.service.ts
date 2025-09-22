import { Types } from 'mongoose';
import AppError from '../utils/appError';
import * as userDao from '../DAOs/user.dao';
import * as conversationDao from '../DAOs/conversation.dao';
import Conversation from '../db/schemas/conversation.schema';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const getAllUserConversations = async (userId: Types.ObjectId) => {
  const conversations = await conversationDao.getAllUserConversations(userId);

  return conversations;
};

export const startNewConversation = async (currentUserId: Types.ObjectId, email: string) => {
  const recipientUser = await userDao.getUser({ email });

  if (!recipientUser) {
    throw new AppError('No user found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  if (currentUserId.equals(recipientUser._id)) {
    throw new AppError(
      'User can not start a conversation with himself',
      RESPONSE_STATUSES.BAD_REQUEST,
    );
  }

  const members = [currentUserId.toString(), recipientUser._id.toString()];
  const roomId =
    members[0] < members[1] ? `${members[0]}-${members[1]}` : `${members[1]}-${members[0]}`;

  let conversation = await conversationDao.getConversation(roomId);

  if (!conversation) {
    const created = await Conversation.create({
      roomId,
      members,
    });

    // Populate after creation
    conversation = await Conversation.findById(created._id).populate('members', 'name email _id');
  }

  return conversation;
};

export const deleteConversation = async () => {
  console.log('conversation deleted');
};
