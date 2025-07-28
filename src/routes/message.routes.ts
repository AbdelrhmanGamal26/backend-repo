import express, { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import * as messageController from '../controllers/message.controller';
import authenticatedMiddleware from '../middlewares/authenticatedMiddleware';

const messageRouter: Router = express.Router();

messageRouter.use(authenticatedMiddleware);

messageRouter
  .route('/')
  .get(catchAsync(messageController.getAllConversationMessages))
  .post(catchAsync(messageController.sendConversationMessage))
  .delete(catchAsync(messageController.deleteConversationMessage));

export default messageRouter;
