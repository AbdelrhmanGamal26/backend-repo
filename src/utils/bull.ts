import { Queue, Worker, RedisOptions } from 'bullmq';
import {
  resendVerificationEmailTemplate,
  accountDeletionReminderEmailTemplate,
} from '../constants/emailTemplates';
import sendEmail from './email';
import { BULL_ACCOUNT_JOB_NAME } from '../constants/general';
import handlebarsEmailTemplateCompiler from './handlebarsEmailTemplateCompiler';

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
        message: handlebarsEmailTemplateCompiler(accountDeletionReminderEmailTemplate, {
          name: data.name,
        }),
      });

    if (job.name === BULL_ACCOUNT_JOB_NAME.SEND_EMAIL_VERIFICATION)
      try {
        await sendEmail({
          email: data.userData.email,
          subject: 'Your account verification token (valid for 1 hour)',
          message: handlebarsEmailTemplateCompiler(resendVerificationEmailTemplate, {
            name: data.userData.name,
            verificationUrl: data.verificationUrl,
          }),
        });
      } catch (err) {
        console.error('Failed to send email verification:', err);
      }
  },
  {
    connection: redisConnection,
  },
);
