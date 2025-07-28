import { Express, NextFunction, Request, Response } from 'express';
import authRouter from './auth.routes';
import userRouter from './user.routes';
import AppError from '../utils/appError';
import messageRouter from './message.routes';
import conversationRouter from './conversation.routes';
import RESPONSE_STATUSES from '../constants/responseStatuses';

export const bootstrap = (app: Express) => {
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/messages', messageRouter);
  app.use('/api/v1/conversations', conversationRouter);

  // UNHANDLED ROUTE
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(
      new AppError(`Can't find ${req.originalUrl} on this server!`, RESPONSE_STATUSES.NOT_FOUND),
    );
  });
};
