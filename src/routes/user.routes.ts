import express, { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import { multerUpload } from '../utils/multer';
import { USER_ROLES } from '../constants/general';
import * as userController from '../controllers/user.controller';
import { authorizedMiddleware } from '../middlewares/authorizedMiddleware';
import authenticatedMiddleware from '../middlewares/authenticatedMiddleware';
import bodyValidationMiddleware from '../middlewares/bodyValidationMiddleware';
import { imageCompressor } from '../middlewares/sharpImageCompressorMiddleware';
import { updatePasswordSchema, userUpdateSchema } from '../validations/user.validation';

const userRouter: Router = express.Router();

userRouter.use(authenticatedMiddleware);

userRouter.get('/', authorizedMiddleware(USER_ROLES.ADMIN), catchAsync(userController.getAllUsers));

userRouter.get(
  '/active',
  authorizedMiddleware(USER_ROLES.ADMIN),
  catchAsync(userController.getAllActiveUsers),
);

userRouter
  .route('/me')
  .get(catchAsync(userController.getUser))
  .delete(catchAsync(userController.deleteMe));

userRouter.patch(
  '/me/update-profile',
  multerUpload.single('photo'),
  imageCompressor,
  bodyValidationMiddleware(userUpdateSchema),
  catchAsync(userController.updateUserProfile),
);

userRouter.patch(
  '/me/update-password',
  bodyValidationMiddleware(updatePasswordSchema),
  catchAsync(userController.updateUserPassword),
);

userRouter.delete(
  '/delete-user',
  authorizedMiddleware(USER_ROLES.ADMIN),
  catchAsync(userController.deleteUser),
);

userRouter.post('/logout', catchAsync(userController.logout));

export default userRouter;
