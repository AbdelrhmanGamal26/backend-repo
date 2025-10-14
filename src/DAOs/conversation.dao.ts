import { Types } from 'mongoose';
import Conversation from '../db/schemas/conversation.schema';

export const createConversation = (data: { roomId: string; members: string[] }) =>
  Conversation.create(data);

export const getConversation = (data: { [key: string]: any }) =>
  Conversation.findOne(data).populate('members', '_id email name photo');

export const getAllUserConversations = (userId: Types.ObjectId) =>
  Conversation.find({ members: userId }).populate('members', '_id email name photo');
