export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export const ACCOUNT_STATES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted',
} as const;

export const CORS_ORIGINS: string[] = ['http://localhost:5173'];

export const BULL_ACCOUNT_JOB_NAME = {
  SEND_FORGOT: 'send-forgot',
  SEND_REMOVAL: 'send-removal',
  SEND_REMINDER: 'send-reminder',
  SEND_EMAIL_VERIFICATION: 'send-email-verification',
} as const;

export const EMAIL_SENT_STATUS = {
  FAILED: 'failed',
  PENDING: 'pending',
  SUCCESS: 'success',
} as const;

export const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
};
