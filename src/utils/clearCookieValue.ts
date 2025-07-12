import { Response } from 'express';
import { cookieOptions } from '../constants/general';

const clearCookieValue = (res: Response, cookieName: string) => {
  res.clearCookie(cookieName, cookieOptions);
};

export default clearCookieValue;
