import { Request } from 'express';
import { UserDocument } from './userTypes';

export interface CustomRequest extends Request {
  user?: UserDocument;
}
