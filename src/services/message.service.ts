import { Types } from 'mongoose';
import logger from '../utils/winston';
import AppError from '../utils/appError';
import * as messageDao from '../DAOs/message.dao';
import Message from '../db/schemas/message.schema';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import { deleteFromRedis, saveToRedis } from '../utils/redis';

export const getAllConversationMessages = async (conversationId: Types.ObjectId) => {
  const messages = await messageDao.getAllConversationMessages(conversationId);

  return messages;
};

export const sendConversationMessage = async (
  conversationId: Types.ObjectId,
  message: string,
  senderId: Types.ObjectId,
) => {
  const sentMessage = await Message.create({ content: message, conversationId, senderId });

  if (!sentMessage) {
    throw new AppError('Failed to save message', RESPONSE_STATUSES.SERVER);
  }

  try {
    await deleteFromRedis(`conversation:${conversationId}:messages`);
    const updatedMessages = await messageDao.getAllConversationMessages(conversationId);
    await saveToRedis(`conversation:${conversationId}:messages`, updatedMessages);
  } catch (err) {
    logger.warn(`Redis cache refresh failed: ${err}`);
  }

  return sentMessage;
};

export const deleteConversationMessage = async () => {
  console.log('Message deleted');
};
