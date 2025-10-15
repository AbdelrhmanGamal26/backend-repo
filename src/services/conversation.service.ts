import { Types } from 'mongoose';
import AppError from '../utils/appError';
import * as userDao from '../DAOs/user.dao';
import * as conversationDao from '../DAOs/conversation.dao';
import RESPONSE_STATUSES from '../constants/responseStatuses';

// ================================= Start of start conversation =================================== //
export const startNewConversation = async (currentUserId: Types.ObjectId, email: string) => {
  const recipientUser = await userDao.getUser({ email });

  if (!recipientUser) {
    throw new AppError('No user found with that Email', RESPONSE_STATUSES.NOT_FOUND);
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

  let conversation = await conversationDao.getConversation({ roomId });

  if (!conversation) {
    const created = await conversationDao.createConversation({
      roomId,
      members,
    });

    // Populate after creation
    conversation = await conversationDao.getConversation({ _id: created._id });
  }

  return conversation;
};
// ================================= End of start conversation =================================== //

// ================================= Start of get user conversations =================================== //
export const getAllUserConversations = async (userId: Types.ObjectId) => {
  const conversations = await conversationDao.getAllUserConversations(userId);

  return conversations;
};
// ================================= End of get user conversations =================================== //

// ================================= Start of get user conversation =================================== //
export const getConversation = async (conversationId: string) => {
  const conversations = await conversationDao.getConversation({ conversationId });

  return conversations;
};
// ================================= End of get user conversation =================================== //

// ================================= Start of delete conversation =================================== //
export const deleteConversation = async () => {
  console.log('conversation deleted');
};
// ================================= End of delete conversation =================================== //
