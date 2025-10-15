import express, { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import * as conversationController from '../controllers/conversation.controller';
import authenticatedMiddleware from '../middlewares/authenticatedMiddleware';

const conversationRouter: Router = express.Router();

conversationRouter.use(authenticatedMiddleware);

conversationRouter
  .route('/')
  .get(catchAsync(conversationController.getAllUserConversations))
  .post(catchAsync(conversationController.startNewConversation));

conversationRouter
  .route('/:id')
  .get(catchAsync(conversationController.getConversation))
  .delete(catchAsync(conversationController.deleteConversation));

export default conversationRouter;
