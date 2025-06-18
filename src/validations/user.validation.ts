import { z } from 'zod';
import ZOD_VALIDATIONS from './zodValidations';
import { USER_ROLES } from '../constants/general';

export const userCreationSchema = z
  .object({
    name: ZOD_VALIDATIONS.EN_REQ_STR_MIN_MAX(20),
    email: ZOD_VALIDATIONS.EMAIL,
    photo: ZOD_VALIDATIONS.NOT_REQ_STRING,
    role: z.enum([USER_ROLES.ADMIN, USER_ROLES.USER]),
    password: ZOD_VALIDATIONS.PASSWORD,
    confirmPassword: ZOD_VALIDATIONS.REQ_STRING,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords must match!',
    path: ['confirmPassword'], // Specifies the field the error is associated with
  });

export const userUpdateSchema = z
  .object({
    name: ZOD_VALIDATIONS.NOT_REQ_STR_MAX(20),
    photo: ZOD_VALIDATIONS.NOT_REQ_STRING,
  })
  .passthrough();

export const userLoginSchema = z.object({
  email: ZOD_VALIDATIONS.EMAIL,
  password: ZOD_VALIDATIONS.REQ_STRING,
});

export const userForgotPasswordSchema = z.object({
  email: ZOD_VALIDATIONS.EMAIL,
});

export const resetPasswordSchema = z
  .object({
    password: ZOD_VALIDATIONS.PASSWORD,
    confirmPassword: ZOD_VALIDATIONS.REQ_STRING,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords must match!',
    path: ['confirmPassword'],
  });

export const updatePasswordSchema = z
  .object({
    oldPassword: ZOD_VALIDATIONS.PASSWORD,
    newPassword: ZOD_VALIDATIONS.PASSWORD,
    confirmNewPassword: ZOD_VALIDATIONS.REQ_STRING,
  })
  .refine((values) => values.newPassword === values.confirmNewPassword, {
    message: 'Passwords must match!',
    path: ['confirmNewPassword'],
  });
