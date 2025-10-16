import { Types } from 'mongoose';
import logger from '../utils/winston';
import AppError from '../utils/appError';
import * as messageDao from '../DAOs/message.dao';
import { getFromRedis, saveToRedis } from '../utils/redis';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import DURATIONS from '../constants/durations';
import * as conversationDao from '../DAOs/conversation.dao';
import { io } from '../../server';

// ================================= Start of send message =================================== //
export const createMessage = async (
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

  // const conversation = await conversationDao.updateConversation(conversationId, {
  //   hasMessages: true,
  //   lastMessage: { content: sentMessage, sender: senderId, createdAt: new Date() },
  //   updatedAt: new Date()
  // });

  const conversation = await conversationDao.getConversation({ _id: conversationId });

  if (!conversation) {
    throw new AppError('No conversation found with that ID', RESPONSE_STATUSES.NOT_FOUND);
  }

  const isFirstMessage = !conversation?.hasMessages;

  const recipient = conversation?.members.find(
    (member) => member._id.toString() !== senderId.toString(),
  );

  // If this is the FIRST message, emit to recipient's user room
  if (isFirstMessage && recipient) {
    // update the conversation hasMessages field
    conversation.hasMessages = true;

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

  // update conversation
  conversation.lastMessage = {
    content: sentMessage.content,
    sender: senderId,
    createdAt: new Date(),
  };
  conversation.updatedAt = new Date();
  await conversation.save({ validateBeforeSave: false });

  try {
    const cacheKey = `conversation:${conversationId}:messages`;
    const cached = await getFromRedis(cacheKey);

    if (cached) {
      cached.push(sentMessage);
      await saveToRedis(cacheKey, cached, DURATIONS.REDIS_MESSAGE_CACHE_EXPIRATION_IN_SECONDS);
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
export const deleteMessage = async () => {
  console.log('Message deleted');
};
// ================================= End of delete message =================================== //
