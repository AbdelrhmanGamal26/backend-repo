import { Types } from 'mongoose';
import logger from '../utils/winston';
import AppError from '../utils/appError';
import * as messageDao from '../DAOs/message.dao';
import { getFromRedis, saveToRedis } from '../utils/redis';
import RESPONSE_STATUSES from '../constants/responseStatuses';

// ================================= Start of send message =================================== //
export const sendConversationMessage = async (
  conversationId: Types.ObjectId,
  message: string,
  senderId: Types.ObjectId,
) => {
  const sentMessage = await messageDao.createMessage({
    content: message,
    conversationId,
    senderId,
  });

  if (!sentMessage) {
    throw new AppError('Failed to save message', RESPONSE_STATUSES.SERVER);
  }

  try {
    const cacheKey = `conversation:${conversationId}:messages`;
    const cached = await getFromRedis(cacheKey);

    if (cached) {
      cached.push(sentMessage);
      await saveToRedis(cacheKey, cached);
    } else {
      // If cache is missing, fall back to full DB fetch
      const messages = await messageDao.getAllConversationMessages(conversationId);
      await saveToRedis(cacheKey, messages);
    }
  } catch (err) {
    logger.warn(`Redis cache update failed: ${err}`);
  }

  return sentMessage;
};
// ================================= End of send message =================================== //

// ================================= Start of get conversation messages =================================== //
export const getAllConversationMessages = async (conversationId: Types.ObjectId) => {
  const messages = await messageDao.getAllConversationMessages(conversationId);

  return messages;
};
// ================================= End of get conversation messages =================================== //

// ================================= Start of delete message =================================== //
export const deleteConversationMessage = async () => {
  console.log('Message deleted');
};
// ================================= End of delete message =================================== //
