import { Queue, Worker, RedisOptions } from 'bullmq';
import sendEmail from './email';
import { BULL_ACCOUNT_JOB_NAME } from '../constants/general';

export const redisConnection: RedisOptions = {
  host: '127.0.0.1',
  port: 6379,
};

export const accountQueue = new Queue('account-queue', {
  connection: redisConnection,
});

export const accountWorker = new Worker(
  'account-queue',
  async (job) => {
    const data = job.data;

    if (job.name === BULL_ACCOUNT_JOB_NAME.SEND_REMINDER)
      await sendEmail({
        email: data.email,
        subject: 'Account permanent deletion reminder (3 days remains)',
        message: `Hi ${data.name},
      
      We noticed your account is scheduled for deletion in 3 days. If you want to keep your account, please activate it before it's permanently removed.
      
      Thank you,
      The [App Name] Team`,
      });

    if (job.name === BULL_ACCOUNT_JOB_NAME.SEND_EMAIL_VERIFICATION)
      try {
        await sendEmail({
          email: data.userData.email,
          subject: 'Your email verification token (valid for 1 hour)',
          message: `Hi ${data.userData.name},
      
      Thank you for registering with [Your App Name]!
      
      Please verify your email address by clicking the link below. This helps us ensure the security of your account.
      
      Verify your email: ${data.verificationUrl}
      
      This link will expire in 1 hour.
      
      If you didn't create an account, you can safely ignore this email.
      
      Thanks,
      
      The [Your App Name] Team`,
        });
      } catch (err) {
        console.error('Failed to send email verification:', err);
      }
  },
  {
    connection: redisConnection,
  },
);
