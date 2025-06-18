import { NextFunction, Request, Response } from 'express';

const sanitize = (obj: any) => {
  if (typeof obj !== 'object' || obj === null) return;

  for (const key in obj) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      sanitize(obj[key]); // recursive sanitation
    }
  }
};

export const mongoSanitizeMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);

  next();
};
