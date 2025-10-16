import { Types } from 'mongoose';
import Conversation from '../db/schemas/conversation.schema';

export const createConversation = (data: { roomId: string; members: string[] }) =>
  Conversation.create(data);

export const getAllUserConversations = (userId: Types.ObjectId) =>
  Conversation.find({ members: userId }).populate('members', '_id email name photo lastMessage');

export const getConversation = (data: { [key: string]: any }) =>
  Conversation.findOne(data).populate('members', '_id email name photo lastMessage');

export const updateConversation = (id: Types.ObjectId, data: { [key: string]: any }) =>
  Conversation.findByIdAndUpdate(id, data, { new: true, runValidators: true });
