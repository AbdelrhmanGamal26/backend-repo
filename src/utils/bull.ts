import { Queue, Worker, RedisOptions, Job } from 'bullmq';
import {
  forgotPasswordEmailTemplate,
  accountDeletionEmailTemplate,
  accountVerificationEmailTemplate,
  accountDeletionReminderEmailTemplate,
} from '../constants/emailTemplates';
import logger from './winston';
import sendEmail from './nodemailer';
import * as userDao from '../DAOs/user.dao';
import { EMAIL_SENT_STATUS } from '../constants/general';
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
    } catch (err) {
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
  const user = await userDao.getUserById(job.data.userId);

  if (user) {
    user.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.SUCCESS;
    user.accountActivationEmailSentAt = new Date();
    user.save({ validateBeforeSave: false });
  }

  logger.info(
    `Account verification email sent to user: ${job.data.userData.name}, email: ${job.data.userData.email}`,
  );
});

emailWorker.on('failed', async (job: Job | undefined, _err: Error) => {
  if (!job) return;

  const currentUser = await userDao.getUserById(job.data.userId);
  if (currentUser && currentUser.accountActivationEmailSentStatus !== EMAIL_SENT_STATUS.SUCCESS) {
    currentUser.verifyEmailToken = undefined;
    currentUser.verifyEmailTokenExpires = undefined;
    currentUser.accountActivationEmailSentStatus = EMAIL_SENT_STATUS.FAILED;
    await currentUser.save({ validateBeforeSave: false });
  }

  logger.error(
    `Failed to send account verification email to user: ${job.data.userData.name}, email: ${job.data.userData.email}`,
  );
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
    } catch (err) {
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency,
  },
);

forgotPasswordWorker.on('completed', async (job: Job) => {
  logger.info(
    `Password resetting email sent to user: ${job.data.userData.name}, email: ${job.data.userData.email}`,
  );
});

forgotPasswordWorker.on('failed', async (job: Job | undefined, _err: Error) => {
  if (!job) return;

  const currentUser = await userDao.getUserById(job.data.userId);

  if (currentUser) {
    currentUser.passwordResetToken = undefined;
    currentUser.passwordResetTokenExpires = undefined;
    await currentUser.save({ validateBeforeSave: false });
  }
  logger.error(
    `Failed to send password resetting email to user: ${job.data.userData.name}, email: ${job.data.userData.email}`,
  );
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
    } catch (err) {
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency,
  },
);

reminderWorker.on('completed', async (job: Job) => {
  const user = await userDao.getUserById(job.data.userId);

  if (user) {
    user.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.SUCCESS;
    user.accountInactivationReminderEmailSentAt = new Date();
    await user.save({ validateBeforeSave: false });
  }

  logger.info(
    `Account deletion reminder email sent to user: ${job.data.userData.name}, email: ${job.data.userData.email}`,
  );
});

reminderWorker.on('failed', async (job: Job | undefined, _err: Error) => {
  if (!job) return;

  const currentUser = await userDao.getUserById(job.data.userId);

  if (
    currentUser &&
    currentUser.accountInactivationReminderEmailSentStatus !== EMAIL_SENT_STATUS.SUCCESS
  ) {
    currentUser.accountInactivationReminderEmailSentStatus = EMAIL_SENT_STATUS.FAILED;
    currentUser.accountInactivationReminderEmailSentAt = undefined;
    await currentUser.save({ validateBeforeSave: false });
  }

  logger.error(
    `Failed to send account deletion reminder email to user: ${job.data.userData.name}, email: ${job.data.userData.email}`,
  );
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
    } catch (err) {
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency,
  },
);

accountRemovalWorker.on('completed', async (job) => {
  await userDao.deleteUserById(job.data.userId);

  logger.info(`User: ${job.data.userData.email} received account deletion email.`);
});

accountRemovalWorker.on('failed', async (job: Job | undefined, _err: Error) => {
  if (!job) return;

  logger.error(`User: ${job.data.userData.email} did not receive account deletion email.`);
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
