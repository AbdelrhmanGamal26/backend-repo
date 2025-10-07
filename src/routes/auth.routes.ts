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

authRouter.get('/refresh-token', catchAsync(authController.refreshAccessToken));

authRouter.post(
  '/forgot-password',
  bodyValidationMiddleware(userForgotPasswordSchema),
  catchAsync(authController.forgotPassword),
);

authRouter.get(
  '/verify-reset-token',
  queryParamsValidationMiddleware(resetTokenSchema, 'Invalid reset token'),
  catchAsync(authController.verifyResetToken),
);

authRouter.patch(
  '/reset-password',
  queryParamsValidationMiddleware(resetTokenSchema, 'Invalid reset token'),
  bodyValidationMiddleware(resetPasswordSchema),
  catchAsync(authController.resetPassword),
);

authRouter.get(
  '/verify-email',
  queryParamsValidationMiddleware(verificationTokenSchema, 'Invalid verification token'),
  catchAsync(authController.verifyEmail),
);

authRouter.post(
  '/resend-verification-token',
  bodyValidationMiddleware(userForgotPasswordSchema),
  catchAsync(authController.resendVerificationToken),
);

export default authRouter;
