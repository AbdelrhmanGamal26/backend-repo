import { ZodBoolean, ZodEffects, z } from 'zod';
import REGEX from '../constants/regex';

interface ZodValidations {
  REQ_STRING: z.ZodString;
  NOT_REQ_STRING: z.ZodOptional<z.ZodString>;
  EMAIL: z.ZodString;
  NOT_REQ_EMAIL: z.ZodOptional<z.ZodString>;
  REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodString;
  NOT_REQ_STR_MAX: (max?: number) => z.ZodOptional<z.ZodString>;
  PASSWORD: z.ZodString;
  PHONE_NUMBER: z.ZodString;
  BOOLEAN: z.ZodBoolean;
  TRUE_BOOLEAN: ZodEffects<ZodBoolean, boolean, boolean>;
  REQ_INT: z.ZodNumber;
  NOT_REQ_INT: z.ZodOptional<z.ZodNumber>;
  NOT_REQ_NUMBER: z.ZodOptional<z.ZodNumber>;
  EN_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodString;
  AR_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodString;
  FR_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodString;
  GE_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodString;
  ES_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodString;
  RU_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodString;
  TR_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodString;
  IT_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodString;
  PT_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodString;
  IT_NOT_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodOptional<z.ZodString>;
  PT_NOT_REQ_STR_MIN_MAX: (max?: number, min?: number) => z.ZodOptional<z.ZodString>;
  NOT_REQ: z.ZodOptional<z.ZodAny>;
  REQ_NUMBER: z.ZodNumber;
  REQ_IMAGE: z.ZodString;
  NOT_REQ_LINK: z.ZodOptional<z.ZodString>;
}

const ZOD_VALIDATIONS: ZodValidations = {
  REQ_STRING: z.string().min(1),
  NOT_REQ_STRING: z.string().optional(),
  EMAIL: z.string().email({ message: 'Invalid email address' }),
  NOT_REQ_EMAIL: z.string().email({ message: 'Invalid email address' }).optional(),
  REQ_STR_MIN_MAX: (max = 50, min = 1) => z.string().min(min).max(max),
  NOT_REQ_STR_MAX: (max = 50) => z.string().max(max).optional(),
  PASSWORD: z.string().regex(REGEX.PASSWORD, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character (@!%*?&)',
  }),
  PHONE_NUMBER: z.string().regex(REGEX.PHONE_NUMBER, {
    message: 'Invalid phone number',
  }),
  BOOLEAN: z.coerce.boolean(),
  TRUE_BOOLEAN: z.coerce.boolean().refine((value) => value === true, {
    message: 'Value must be true',
  }),
  REQ_INT: z.coerce.number().int().min(1),
  NOT_REQ_INT: z.coerce.number().int().optional(),
  NOT_REQ_NUMBER: z.number().nonnegative().optional(),
  EN_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z.string().min(min).max(max).regex(REGEX.ALPHA_NUMERIC, {
      message: 'Invalid English text',
    }),
  AR_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z.string().min(min).max(max).regex(REGEX.ARABIC, {
      message: 'Invalid Arabic text',
    }),
  FR_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z.string().min(min).max(max).regex(REGEX.FRENCH, {
      message: 'Invalid French text',
    }),
  GE_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z.string().min(min).max(max).regex(REGEX.GERMAN, {
      message: 'Invalid German text',
    }),
  ES_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z.string().min(min).max(max).regex(REGEX.SPANISH, {
      message: 'Invalid Spanish text',
    }),
  RU_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z.string().min(min).max(max).regex(REGEX.RUSSIAN, {
      message: 'Invalid Russian text',
    }),
  TR_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z.string().min(min).max(max).regex(REGEX.TURKISH, {
      message: 'Invalid Turkish text',
    }),
  IT_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z.string().min(min).max(max).regex(REGEX.ITALIAN, {
      message: 'Invalid Italian text',
    }),
  IT_NOT_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z
      .string()
      .min(min)
      .max(max)
      .regex(REGEX.ITALIAN, {
        message: 'Invalid Italian text',
      })
      .optional(),
  PT_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z.string().min(min).max(max).regex(REGEX.PORTUGUESE, {
      message: 'Invalid Portuguese text',
    }),
  PT_NOT_REQ_STR_MIN_MAX: (max = 50, min = 1) =>
    z
      .string()
      .min(min)
      .max(max)
      .regex(REGEX.PORTUGUESE, {
        message: 'Invalid Portuguese text',
      })
      .optional(),
  NOT_REQ: z.any().optional(),
  REQ_NUMBER: z.number().nonnegative(),
  REQ_IMAGE: z.string().min(1, 'Image is required').max(255, 'Image URL is too long'),
  NOT_REQ_LINK: z.string().url().optional(), // add a proper validation message
};

export default ZOD_VALIDATIONS;
