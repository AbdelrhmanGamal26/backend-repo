import { Types } from 'mongoose';
import Message from '../db/schemas/message.schema';
import { getFromRedis, saveToRedis } from '../utils/redis';

export const getAllConversationMessages = async (conversationId: Types.ObjectId) => {
  const cachedMessages = await getFromRedis(`conversation:${conversationId}:messages`);
  if (cachedMessages) {
    return cachedMessages;
  } else {
    const messages = await Message.find({ conversationId });
    await saveToRedis(`conversation:${conversationId}:messages`, messages);
    return messages;
  }
};
