import { Types } from 'mongoose';
import { Queue, Worker, RedisOptions, Job } from 'bullmq';
import {
  forgotPasswordEmailTemplate,
  accountDeletionEmailTemplate,
  accountVerificationEmailTemplate,
  accountDeletionReminderEmailTemplate,
} from '../constants/emailTemplates';
import sendEmail from './nodemailer';
import User from '../db/schemas/user.schema';
import { EMAIL_SENT_STATUS } from '../constants/general';
import { logCompletedJob, logFailedJob } from './logging';
import handlebarsEmailTemplateCompiler from './handlebarsEmailTemplateCompiler';

const concurrency = 5;

const redisConnection: RedisOptions = {
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
        message: handlebarsEmailTemplateCompiler(accountVerificationEmailTemplate, {
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
    concurrency,
  },
);

emailWorker.on('completed', async (job: Job) => {
  const userId = job.data.userId as Types.ObjectId;

  const user = await User.findById(userId);

  if (user) {
    user.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.SUCCESS;
    user.accountActivationEmailSentAt = new Date();
    user.save({ validateBeforeSave: false });
  }
});

emailWorker.on('failed', async (job: Job | undefined, _err: Error) => {
  if (!job) return;

  const userId = job.data.userId as Types.ObjectId;

  const currentUser = await User.findById(userId);
  if (currentUser && currentUser.accountActivationEmailSentStatus !== EMAIL_SENT_STATUS.SUCCESS) {
    currentUser.verifyEmailToken = undefined;
    currentUser.verifyEmailTokenExpires = undefined;
    currentUser.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.FAILED;
    await currentUser.save({ validateBeforeSave: false });
  }

  // logger.error('Failed to queue email verification job', err);   *this is for later*
});

export const forgotPasswordQueue = new Queue('forgot-queue', {
  connection: redisConnection,
});

export const forgotPasswordWorker = new Worker(
  'forgot-queue',
  async (job) => {
    const data = job.data;

    try {
      await sendEmail({
        email: data.userData.email,
        subject: 'Your password reset token (valid for 10 minutes)',
        message: handlebarsEmailTemplateCompiler(forgotPasswordEmailTemplate, {
          name: data.userData.name,
          resetURL: data.resetUrl,
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
    concurrency,
  },
);

forgotPasswordWorker.on('completed', async (job: Job) => {
  const userId = job.data.userId as Types.ObjectId;

  const currentUser = await User.findById(userId);

  if (currentUser) {
    console.log('Check your email for the reset password form');
    // logger.success(`Email sent to user: ${currentUser.name}`);   *this is for later*
  }
  // logger.error('Failed to queue email verification job', err);   *this is for later*
});

forgotPasswordWorker.on('failed', async (job: Job | undefined, _err: Error) => {
  if (!job) return;

  const userId = job.data.userId as Types.ObjectId;

  const currentUser = await User.findById(userId);

  if (currentUser) {
    currentUser.passwordResetToken = undefined;
    currentUser.passwordResetTokenExpires = undefined;
    await currentUser.save({ validateBeforeSave: false });
  }
  // logger.error('Failed to queue email verification job', err);   *this is for later*
});

export const reminderQueue = new Queue('reminder-queue', {
  connection: redisConnection,
});

export const reminderWorker = new Worker(
  'reminder-queue',
  async (job) => {
    const data = job.data;

    const gracePeriod = 3;
    const remainingPeriod = gracePeriod - job.attemptsMade;

    try {
      await sendEmail({
        email: data.userData.email,
        subject: `Account permanent deletion reminder (${remainingPeriod} days remaining)`,
        message: handlebarsEmailTemplateCompiler(accountDeletionReminderEmailTemplate, {
          name: data.userData.name,
          remainingPeriod: `${remainingPeriod}`,
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
    concurrency,
  },
);

reminderWorker.on('completed', async (job: Job) => {
  const userId = job.data.userId as Types.ObjectId;

  const user = await User.findById(userId);

  if (user) {
    user.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.SUCCESS;
    user.accountInactivationReminderEmailSentAt = new Date();
    await user.save({ validateBeforeSave: false });
  }
});

reminderWorker.on('failed', async (job: Job | undefined, _err: Error) => {
  if (!job) return;

  const userId = job.data.userId as Types.ObjectId;

  const currentUser = await User.findById(userId);

  if (
    currentUser &&
    currentUser.accountInactivationReminderEmailSentStatus !== EMAIL_SENT_STATUS.SUCCESS
  ) {
    currentUser.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.FAILED;
    currentUser.accountInactivationReminderEmailSentAt = undefined;
    await currentUser.save({ validateBeforeSave: false });
  }
});

export const accountRemovalQueue = new Queue('removal-queue', {
  connection: redisConnection,
});

export const accountRemovalWorker = new Worker(
  'removal-queue',
  async (job) => {
    const data = job.data;

    try {
      await sendEmail({
        email: data.userData.email,
        subject: 'Account permanent deletion.',
        message: handlebarsEmailTemplateCompiler(accountDeletionEmailTemplate, {
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
    concurrency,
  },
);

accountRemovalWorker.on('completed', async (job) => {
  const userId = job.data.userId as Types.ObjectId;

  await User.findByIdAndDelete(userId);

  return;
});

accountRemovalWorker.on('failed', async (job: Job | undefined, _err: Error) => {
  if (!job) return;

  // const userId = job.data.userId as Types.ObjectId;
  // logger.warn(`Account deletion job for user ${userId} failed: ${err?.message}`);
});

const BULL_JOB_ATTEMPTS = 3;

export const getBullJobSettings = (
  initialDelay: number,
  jobId: string,
  backoffType: string,
  backoffDelay: number,
) => {
  return {
    delay: initialDelay,
    jobId,
    attempts: BULL_JOB_ATTEMPTS,
    backoff: {
      type: backoffType,
      delay: backoffDelay,
    },
  };
};
