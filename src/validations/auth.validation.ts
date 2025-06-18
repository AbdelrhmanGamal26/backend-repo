import { z } from 'zod';
import ZOD_VALIDATIONS from './zodValidations';

export const resetTokenSchema = z.object({
  resetToken: ZOD_VALIDATIONS.EN_REQ_STR_MIN_MAX(100),
});

export const verificationTokenSchema = z.object({
  verificationToken: ZOD_VALIDATIONS.EN_REQ_STR_MIN_MAX(100),
});
