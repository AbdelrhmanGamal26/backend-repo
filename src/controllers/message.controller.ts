import { Types } from 'mongoose';
import { Request, Response } from 'express';
import { CustomRequest } from '../@types/generalTypes';
import RESPONSE_STATUSES from '../constants/responseStatuses';
import * as messageServices from '../services/message.service';

export const getAllConversationMessages = async (req: CustomRequest, res: Response) => {
  const conversationIdStr = Array.isArray(req.query?.conversationId)
    ? req.query.conversationId[0]
    : req.query?.conversationId;

  if (
    !conversationIdStr ||
    typeof conversationIdStr !== 'string' ||
    !Types.ObjectId.isValid(conversationIdStr)
  ) {
    return res.status(RESPONSE_STATUSES.BAD_REQUEST).json({ error: 'Invalid conversationId' });
  }

  const conversationId = new Types.ObjectId(conversationIdStr);

  const messages = await messageServices.getAllConversationMessages(conversationId);

  res.status(RESPONSE_STATUSES.SUCCESS).json({
    data: {
      messages,
    },
  });
};

export const sendConversationMessage = async (req: CustomRequest, res: Response) => {
  const { conversationId, message } = req.body;

  const sentMessage = await messageServices.sendConversationMessage(conversationId, message);

  res.status(RESPONSE_STATUSES.CREATED).json({
    data: {
      message: sentMessage,
    },
  });
};

export const deleteConversationMessage = async (_req: Request, _res: Response) => {
  await messageServices.deleteConversationMessage();
};
