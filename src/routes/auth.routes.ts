import express, { Router } from 'express';
import {
  userLoginSchema,
  userCreationSchema,
  resetPasswordSchema,
  userForgotPasswordSchema,
} from '../validations/user.validation';
import catchAsync from '../utils/catchAsync';
import * as authController from '../controllers/auth.controller';
import bodyValidationMiddleware from '../middlewares/bodyValidationMiddleware';
import { resetTokenSchema, verificationTokenSchema } from '../validations/auth.validation';
import { queryParamsValidationMiddleware } from '../middlewares/queryParamsValidationMiddleware';

const authRouter: Router = express.Router();

authRouter.post(
  '/signup',
  bodyValidationMiddleware(userCreationSchema),
  catchAsync(authController.createUser),
);

authRouter.post(
  '/login',
  bodyValidationMiddleware(userLoginSchema),
  catchAsync(authController.loginUser),
);

authRouter.post(
  '/forgotPassword',
  bodyValidationMiddleware(userForgotPasswordSchema),
  catchAsync(authController.forgotPassword),
);

authRouter.patch(
  '/resetPassword',
  queryParamsValidationMiddleware(resetTokenSchema),
  bodyValidationMiddleware(resetPasswordSchema),
  catchAsync(authController.resetPassword),
);

authRouter.post(
  '/verifyEmail',
  queryParamsValidationMiddleware(verificationTokenSchema),
  catchAsync(authController.verifyEmailToken),
);

authRouter.post(
  '/resendVerificationToken',
  bodyValidationMiddleware(userForgotPasswordSchema),
  catchAsync(authController.resendVerificationToken),
);

export default authRouter;
