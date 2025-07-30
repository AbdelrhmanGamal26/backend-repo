import { Types } from 'mongoose';
import Conversation from '../db/schemas/conversation.schema';

export const getConversation = (roomId: string) =>
  Conversation.findOne({ roomId }).populate({ path: 'members', select: '_id email name' });

export const getAllUserConversations = (userId: Types.ObjectId) =>
  Conversation.find({ members: userId }).populate({ path: 'members', select: '_id email name' });
