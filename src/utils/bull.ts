import { Types } from 'mongoose';
import { Queue, Worker, RedisOptions, Job } from 'bullmq';
import {
  resendVerificationEmailTemplate,
  accountDeletionReminderEmailTemplate,
} from '../constants/emailTemplates';
import sendEmail from './nodemailer';
import User from '../db/schemas/user.schema';
import DURATIONS from '../constants/durations';
import { logCompletedJob, logFailedJob } from './logging';
import { BULL_ACCOUNT_JOB_NAME, EMAIL_SENT_STATUS } from '../constants/general';
import handlebarsEmailTemplateCompiler from './handlebarsEmailTemplateCompiler';

export const redisConnection: RedisOptions = {
  host: '127.0.0.1',
  port: 6379,
};

export const emailQueue = new Queue('email-queue', {
  connection: redisConnection,
});

export const emailWorker = new Worker(
  'email-queue',
  async (job) => {
    const data = job.data;

    try {
      await sendEmail({
        email: data.userData.email,
        subject: 'Your account verification token (valid for 1 hour)',
        message: handlebarsEmailTemplateCompiler(resendVerificationEmailTemplate, {
          name: data.userData.name,
          verificationUrl: data.verificationUrl,
        }),
      });

      // log the job details to the log file in case of success
      logCompletedJob(job);
    } catch (err) {
      // log the error to the errors log file in case of failure
      logFailedJob(job, err);

      // Let BullMQ retry by throwing the error
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

emailWorker.on('completed', async (job: Job) => {
  const userId = job.data.userId as Types.ObjectId;

  const user = await User.findById(userId);

  if (user) {
    user.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.SUCCESS;
    user.accountActivationEmailSentAt = new Date(Date.now());
    user.save({ validateBeforeSave: false });
  }
});

emailWorker.on('failed', async (job: Job | undefined, err: Error) => {
  if (!job) return;

  console.log(`Failed to send email to ${job.data.userData.email}.`, err);

  const userId = job.data.userId as Types.ObjectId;

  // Check if we should retry (check current user status from DB)
  const currentUser = await User.findById(userId);
  if (currentUser && currentUser.accountActivationEmailSentStatus !== EMAIL_SENT_STATUS.SUCCESS) {
    try {
      await dailyRetryQueue.add(BULL_ACCOUNT_JOB_NAME.SEND_EMAIL_VERIFICATION, job.data, {
        delay: DURATIONS.BULL_JOB_EMAIL_FAILURE_RETRY_DURATION,
        jobId: `daily-email-${job.data.userData.email}-${Date.now()}`,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: DURATIONS.BULL_JOB_EMAIL_FAILURE_RETRY_DURATION,
        },
      });
    } catch (error) {
      console.log(`Account activation job addition to the retry queue failed: ${error}`);
      currentUser.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.FAILED;
      await currentUser.save({ validateBeforeSave: false });
      throw error;
    }
  }
});

export const accountQueue = new Queue('account-queue', {
  connection: redisConnection,
});

export const accountWorker = new Worker(
  'account-queue',
  async (job) => {
    const data = job.data;

    try {
      await sendEmail({
        email: data.userData.email,
        subject: 'Account permanent deletion reminder (3 days remaining)',
        message: handlebarsEmailTemplateCompiler(accountDeletionReminderEmailTemplate, {
          name: data.userData.name,
        }),
      });

      logCompletedJob(job);
    } catch (err) {
      logFailedJob(job, err);
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

accountWorker.on('completed', async (job: Job) => {
  const userId = job.data.userId as Types.ObjectId;

  const user = await User.findById(userId);

  if (user) {
    user.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.SUCCESS;
    user.accountInactivationReminderEmailSentAt = new Date(Date.now());
    await user.save({ validateBeforeSave: false });
  }
});

accountWorker.on('failed', async (job: Job | undefined, err: Error) => {
  if (!job) return;

  console.log(`Failed to send email to ${job.data.userData.email}.`, err);

  const userId = job.data.userId as Types.ObjectId;

  const currentUser = await User.findById(userId);

  if (
    currentUser &&
    currentUser.accountInactivationReminderEmailSentStatus !== EMAIL_SENT_STATUS.SUCCESS
  ) {
    try {
      await dailyRetryQueue.add(BULL_ACCOUNT_JOB_NAME.SEND_REMINDER, job.data, {
        delay: DURATIONS.BULL_JOB_FAILED_SENDING_DELAY_PERIOD,
        jobId: `daily-reminder-${job.data.userData.email}-${Date.now()}`, // Unique ID,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: DURATIONS.BULL_JOB_FAILED_SENDING_DELAY_PERIOD,
        },
      });
    } catch (error) {
      console.log(`Account deletion reminder job addition to the retry queue failed: ${error}`);
      currentUser.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.FAILED;
      await currentUser.save({ validateBeforeSave: false });
    }
  }
});

export const dailyRetryQueue = new Queue('daily-retry-queue', {
  connection: redisConnection,
});

export const dailyRetryWorker = new Worker(
  'daily-retry-queue',
  async (job) => {
    const data = job.data;

    try {
      if (job.name === BULL_ACCOUNT_JOB_NAME.SEND_EMAIL_VERIFICATION) {
        await sendEmail({
          email: data.userData.email,
          subject: 'Your account verification token (valid for 1 hour)',
          message: handlebarsEmailTemplateCompiler(resendVerificationEmailTemplate, {
            name: data.userData.name,
            verificationUrl: data.verificationUrl,
          }),
        });
      }

      if (job.name === BULL_ACCOUNT_JOB_NAME.SEND_REMINDER) {
        await sendEmail({
          email: data.userData.email,
          subject: `Account permanent deletion reminder (${2 - job.attemptsMade} days remaining)`,
          message: handlebarsEmailTemplateCompiler(accountDeletionReminderEmailTemplate, {
            name: data.userData.name,
          }),
        });
      }

      logCompletedJob(job);
    } catch (err) {
      console.error(`Failed sending ${job.name} to ${data.userData.email}`, err);
      logFailedJob(job, err);
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

// Daily retry worker events
dailyRetryWorker.on('completed', async (job: Job) => {
  console.log(`Daily retry job ${job.id} completed successfully`);

  try {
    const userId = job.data.userId as Types.ObjectId;

    const currentUser = await User.findById(userId);

    if (currentUser) {
      if (job.name === BULL_ACCOUNT_JOB_NAME.SEND_EMAIL_VERIFICATION) {
        currentUser.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.SUCCESS;
        currentUser.accountActivationEmailSentAt = new Date(Date.now());
      } else if (job.name === BULL_ACCOUNT_JOB_NAME.SEND_REMINDER) {
        currentUser.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.SUCCESS;
        currentUser.accountInactivationReminderEmailSentAt = new Date(Date.now());
      }

      await currentUser.save({ validateBeforeSave: false });
    }
  } catch (error) {
    console.error('Failed to update user status after retry completion:', error);
  }
});

dailyRetryWorker.on('failed', async (job: Job | undefined, err: Error) => {
  if (!job) return;
  console.error(`Daily retry job ${job.id} failed:`, err);

  try {
    const userId = job.data.userId as Types.ObjectId;

    const currentUser = await User.findById(userId);

    if (currentUser) {
      if (job.name === BULL_ACCOUNT_JOB_NAME.SEND_EMAIL_VERIFICATION) {
        currentUser.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.FAILED;
      } else if (job.name === BULL_ACCOUNT_JOB_NAME.SEND_REMINDER) {
        currentUser.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.FAILED;
      }

      await currentUser.save({ validateBeforeSave: false });
    }
  } catch (error) {
    console.error('Failed to update user status after retry failure:', error);
  }
});

const BULL_JOB_ATTEMPTS = 3;

export const getBullJobSettings = (initialDelay: number, jobId: string) => {
  return {
    delay: initialDelay,
    jobId,
    attempts: BULL_JOB_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: DURATIONS.BULL_JOB_EMAIL_FAILURE_RETRY_DURATION,
    },
  };
};
