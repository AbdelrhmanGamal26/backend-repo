import { Response } from 'express';
import DURATIONS from '../constants/durations';
import { cookieOptions } from '../constants/general';

const setValueToCookies = (res: Response, cookieName: string, value: string, maxAge?: number) => {
  res.cookie(cookieName, value, {
    ...cookieOptions,
    maxAge: maxAge || DURATIONS.COOKIE_MAX_AGE, // 15 minutes unless set to another value
  });
};

export default setValueToCookies;
