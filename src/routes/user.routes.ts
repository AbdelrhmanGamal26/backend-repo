import express, { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import * as userController from '../controllers/user.controller';
import authenticatedMiddleware from '../middlewares/authenticatedMiddleware';
import bodyValidationMiddleware from '../middlewares/bodyValidationMiddleware';
import { updatePasswordSchema, userUpdateSchema } from '../validations/user.validation';
import { authorizedMiddleware } from '../middlewares/authorizedMiddleware';
import { USER_ROLES } from '../constants/general';

const userRouter: Router = express.Router();

userRouter.use(authenticatedMiddleware);

userRouter.get('/', catchAsync(userController.getAllUsers));

userRouter.get('/active', catchAsync(userController.getAllActiveUsers));

userRouter.delete(
  '/delete-user',
  authorizedMiddleware(USER_ROLES.ADMIN),
  catchAsync(userController.deleteUser),
);

userRouter
  .route('/me')
  .get(catchAsync(userController.getUser))
  .delete(catchAsync(userController.deleteMe));

userRouter.patch(
  '/me/update-profile',
  bodyValidationMiddleware(userUpdateSchema),
  catchAsync(userController.updateUserProfile),
);

userRouter.patch(
  '/me/update-password',
  bodyValidationMiddleware(updatePasswordSchema),
  catchAsync(userController.updateUserPassword),
);

userRouter.post('/logout', catchAsync(userController.logout));

export default userRouter;
