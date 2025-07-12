import { Response } from 'express';
import { cookieOptions } from '../constants/general';

const setValueToCookies = (res: Response, cookieName: string, value: string, maxAge?: number) => {
  res.cookie(cookieName, value, {
    ...cookieOptions,
    maxAge: maxAge || 15 * 60 * 1000, // 15 minutes unless set to another value
  });
};

export default setValueToCookies;

// httpOnly: true

//  Prevents client-side JavaScript (like in the browser) from accessing the cookie.
//  This helps protect against Cross-Site Scripting (XSS) attacks.
//  The cookie is only sent in HTTP requests, not exposed via document.cookie.
//  Best practice for storing sensitive tokens like JWT.

// -------------------------------------------------- //

// secure: process.env.NODE_ENV === 'production'

// When set to true, the cookie is only sent over HTTPS.
// In development, you might not use HTTPS, so we conditionally enable this:
// true in production (where HTTPS is expected)
// false in development (so it works over HTTP)
// Prevents tokens from being intercepted over unencrypted connections.

// -------------------------------------------------- //

// sameSite: 'strict'

// Controls when cookies are sent with cross-origin requests.
// 'strict' means the cookie won’t be sent with any cross-site requests, including links from other sites.
// Helps protect against Cross-Site Request Forgery (CSRF).

// Options:

// 'strict': Max protection, no cross-origin access.
// 'lax': Allows sending cookie with top-level navigation (e.g., link click).
// 'none': Allows all cross-site requests (must use secure: true if you set this).
// 'strict' is good for API-only apps or SPAs without cross-domain auth.

// -------------------------------------------------- //

// maxAge: 24 * 60 * 60 * 1000

// Specifies how long (in milliseconds) the cookie should last.
// Here: 1 day (24 hours × 60 minutes × 60 seconds × 1000 ms).

// Alternative:

// You can also use expires: new Date(Date.now() + ...) if you prefer absolute expiration.
