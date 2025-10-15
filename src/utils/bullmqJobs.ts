import {
  emailQueue,
  reminderQueue,
  getBullJobSettings,
  accountRemovalQueue,
  forgotPasswordQueue,
  accountRemovalByAdminQueue,
} from './bull';
import DURATIONS from '../constants/durations';
import { UserDocument } from '../@types/userTypes';
import { BULL_ACCOUNT_JOB_NAME } from '../constants/general';

export const sendAccountActivationEmail = async (user: UserDocument, verificationUrl: string) =>
  await emailQueue.add(
    BULL_ACCOUNT_JOB_NAME.SEND_EMAIL_VERIFICATION,
    {
      userData: {
        email: user.email,
        name: user.name,
      },
      verificationUrl,
      userId: user._id,
    },
    getBullJobSettings(
      DURATIONS.SEND_EMAIL_VERIFICATION_DELAY_PERIOD,
      `email-${user._id}`,
      'exponential',
      DURATIONS.BULL_JOB_EMAIL_FAILURE_RETRY_DURATION,
    ),
  );

export const sendForgotPasswordEmail = async (user: UserDocument, resetUrl: string) =>
  await forgotPasswordQueue.add(
    BULL_ACCOUNT_JOB_NAME.SEND_FORGOT,
    {
      userData: {
        email: user.email,
        name: user.name,
      },
      resetUrl,
      userId: user._id,
    },
    getBullJobSettings(
      DURATIONS.SEND_EMAIL_VERIFICATION_DELAY_PERIOD,
      `forgot-${user._id}`,
      'exponential',
      DURATIONS.BULL_JOB_EMAIL_FAILURE_RETRY_DURATION,
    ),
  );

export const sendAccountDeletionReminderEmail = async (
  user: UserDocument,
  accountDeletionReminderDelay: number,
) =>
  await reminderQueue.add(
    BULL_ACCOUNT_JOB_NAME.SEND_REMINDER,
    {
      userData: {
        email: user.email,
        name: user.name,
      },
      userId: user._id,
    },
    getBullJobSettings(
      accountDeletionReminderDelay,
      `reminder-${user._id}`,
      'fixed',
      DURATIONS.BULL_JOB_FAILED_SENDING_RETRY_DELAY_PERIOD,
    ),
  );

export const sendAccountDeletionEmail = async (user: UserDocument, jobDelay: number) =>
  await accountRemovalQueue.add(
    BULL_ACCOUNT_JOB_NAME.SEND_REMOVAL,
    {
      userData: {
        email: user.email,
        name: user.name,
      },
      userId: user._id,
    },
    {
      delay: jobDelay,
      jobId: `removal-${user._id}`,
    },
  );

export const sendAccountDeletionByAdminEmail = async (user: UserDocument, jobDelay: number) =>
  await accountRemovalByAdminQueue.add(
    BULL_ACCOUNT_JOB_NAME.SEND_REMOVAL_BY_ADMIN,
    {
      userData: {
        email: user.email,
        name: user.name,
      },
      userId: user._id,
    },
    {
      delay: jobDelay,
      jobId: `removal-by-admin-${user._id}`,
    },
  );
