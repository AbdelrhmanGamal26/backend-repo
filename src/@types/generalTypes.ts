import { Request } from 'express';
import { UserDocument } from './userTypes';

export interface CustomRequest extends Request {
  user?: UserDocument;
}

export interface ServiceResponse {
  status: number;
  message: string;
}
