import * as z from 'zod';
import AppError from '../utils/appError';
import RESPONSE_STATUSES from '../constants/responseStatuses';

const errorMap: z.ZodErrorMap = (err, ctx) => {
  if (err.message) return { message: err.message }; // Use custom message if provided

  switch (err.code) {
    case z.ZodIssueCode.invalid_type:
      return {
        message: `${err.path[0]} must be a ${err.expected}, but received ${err.received}`,
      };
    case z.ZodIssueCode.too_small:
      if (err.type === 'string') {
        return {
          message: `${err.path[0]} must be at least ${err.minimum} characters long`,
        };
      }
  }

  return { message: ctx.defaultError }; // Fallback to default message
};

interface ValidateSchema {
  Schema: z.Schema;
  data: unknown;
}

const validateSchema = ({ Schema, data }: ValidateSchema) => {
  try {
    return Schema.parse(data, { errorMap });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errorsMessages = err.errors?.map((err) => err.message);
      const message = JSON.stringify(errorsMessages);
      throw new AppError(message, RESPONSE_STATUSES.BAD_REQUEST);
    }
  }
};

export default validateSchema;
