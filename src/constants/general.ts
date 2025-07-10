export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export const ACCOUNT_STATES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export const CORS_ORIGINS: string[] = ['http://localhost:3000', 'http://localhost:5173'];

export const EMAIL_VERIFICATION_STATUSES = {
  INVALID: 'invalid',
  INVALID_OR_EXPIRED: 'invalid_or_expired',
  ALREADY_VERIFIED: 'already_verified',
  VERIFIED: 'verified',
} as const;

export const BULL_ACCOUNT_JOB_NAME = {
  SEND_EMAIL_VERIFICATION: 'send-email-verification',
  SEND_REMINDER: 'send-reminder',
} as const;

export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
