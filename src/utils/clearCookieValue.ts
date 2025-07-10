import { Response } from 'express';

const clearCookieValue = (res: Response, cookieName: string) => {
  console.log('visited');
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  });
};

export default clearCookieValue;
