import { Types } from 'mongoose';
import DURATIONS from '../constants/durations';
import Message from '../db/schemas/message.schema';
import { getFromRedis, saveToRedis } from '../utils/redis';

export const createMessage = (data: { [key: string]: any }) => Message.create(data);

export const getAllConversationMessages = async (conversationId: Types.ObjectId) => {
  const cacheKey = `conversation:${conversationId}:messages`;
  const cachedMessages = await getFromRedis(cacheKey);

  if (cachedMessages) {
    return cachedMessages;
  } else {
    const messages = await Message.find({ conversationId }).lean();
    await saveToRedis(
      cacheKey,
      messages,
      DURATIONS.MESSAGES_EXPIRATION_PERIOD_IN_REDIS_CACHE_IN_SECONDS,
    );

    return messages;
  }
};
