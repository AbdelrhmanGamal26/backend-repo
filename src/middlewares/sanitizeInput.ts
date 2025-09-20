import { Request, Response, NextFunction } from 'express';
import xss from 'xss';

const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') return xss(input);
  if (Array.isArray(input)) return input.map(sanitizeInput);
  if (typeof input === 'object' && input !== null) {
    for (const key in input) {
      input[key] = sanitizeInput(input[key]);
    }
  }
  return input;
};

export const xssSanitizer = (req: Request, _res: Response, next: NextFunction) => {
  sanitizeInput(req.body);
  sanitizeInput(req.params);
  sanitizeInput(req.query); // mutate in place instead of reassigning

  next();
};
