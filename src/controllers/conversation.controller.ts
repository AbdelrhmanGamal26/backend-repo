import { Response } from 'express';
import { CustomRequest } from '../@types/generalTypes';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import * as conversationServices from '../services/conversation.service';

export const getAllUserConversations = async (req: CustomRequest, res: Response) => {
  const userId = req.user!._id;

  const conversations = await conversationServices.getAllUserConversations(userId);

  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      conversations,
    },
  });
};

export const startNewConversation = async (req: CustomRequest, res: Response) => {
  const currentUserId = req.user!._id;
  const recipientEmail = req.body.recipientEmail as string;
  const conversation = await conversationServices.startNewConversation(
    currentUserId,
    recipientEmail,
  );

  res.status(RESPONSE_STATUSES.CREATED).json({
    data: {
      conversation,
    },
  });
};

export const deleteConversation = async (_req: CustomRequest, _res: Response) => {
  await conversationServices.deleteConversation();
};
