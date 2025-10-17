import { Types } from 'mongoose';
import { io } from '../../server';
import logger from '../utils/winston';
import AppError from '../utils/appError';
import DURATIONS from '../constants/durations';
import * as messageDao from '../DAOs/message.dao';
import { getFromRedis, saveToRedis } from '../utils/redis';
import * as conversationDao from '../DAOs/conversation.dao';
import RESPONSE_STATUSES from '../constants/responseStatuses';

// ================================= Start of send message =================================== //
export const createMessage = async (
  conversationId: Types.ObjectId,
  message: string,
  senderId: Types.ObjectId,
) => {
  // Create message and get conversation in parallel
  const [sentMessage, conversation] = await Promise.all([
    messageDao.createMessage({
      content: message,
      conversationId,
      senderId,
    }),
    // Use lean() to get plain JS object (faster than Mongoose document)
    conversationDao.getConversation({ _id: conversationId }).lean(),
  ]);

  if (!sentMessage) {
    throw new AppError('Failed to save message', RESPONSE_STATUSES.SERVER);
  }

  if (!conversation) {
    throw new AppError('No conversation found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  const isFirstMessage = !conversation.hasMessages;
  const recipient = conversation.members.find(
    (member: any) => member._id.toString() !== senderId.toString(),
  );

  // Update conversation directly in DB (no need to load full document)
  const updatePromise = conversationDao.updateConversation(conversationId, {
    hasMessages: true,
    'lastMessage.content': sentMessage.content,
    'lastMessage.sender': senderId,
    'lastMessage.createdAt': new Date(),
    updatedAt: new Date(),
  });

  // Don't wait for update to complete - do it in background
  updatePromise.catch((err) => logger.error('Failed to update conversation:', err));

  // Handle non-critical operations asynchronously
  setImmediate(() => {
    // Socket event
    if (isFirstMessage && recipient) {
      io.to(`user-${recipient._id}`).emit('newConversationWithMessage', {
        conversation: {
          _id: conversation._id,
          roomId: conversation.roomId,
          members: conversation.members,
          createdAt: conversation.createdAt,
          updatedAt: new Date(),
        },
        message: {
          _id: sentMessage._id,
          content: sentMessage.content,
          senderId: sentMessage.senderId,
          conversationId: sentMessage.conversationId,
          createdAt: sentMessage.createdAt,
        },
      });
    }

    // Redis cache
    (async () => {
      try {
        const cacheKey = `conversation:${conversationId}:messages`;
        const cached = await getFromRedis(cacheKey);

        if (cached && Array.isArray(cached)) {
          cached.push(sentMessage);
          await saveToRedis(cacheKey, cached, DURATIONS.REDIS_MESSAGE_CACHE_EXPIRATION_IN_SECONDS);
        }
      } catch (err) {
        logger.warn(`Redis cache update failed: ${err}`);
      }
    })();
  });

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
export const deleteMessage = async () => {
  console.log('Message deleted');
};
// ================================= End of delete message =================================== //
