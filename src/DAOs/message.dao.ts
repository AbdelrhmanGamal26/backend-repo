import { Types } from 'mongoose';
import Message from '../db/schemas/message.schema';
import { getFromRedis, saveToRedis } from '../utils/redis';

export const createMessage = (data: { [key: string]: any }) => Message.create(data);

export const getAllConversationMessages = async (conversationId: Types.ObjectId) => {
  const cacheKey = `conversation:${conversationId}:messages`;
  const cachedMessages = await getFromRedis(cacheKey);

  if (cachedMessages) {
    return cachedMessages;
  } else {
    const messages = await Message.find({ conversationId });
    await saveToRedis(cacheKey, messages);

    return messages;
  }
};
