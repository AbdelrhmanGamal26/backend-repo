import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import DURATIONS from '../../constants/durations';
import { HydratedDocument, Schema, model } from 'mongoose';
import { UserDocument, UserSchemaFields } from '../../@types/userTypes';
import { ACCOUNT_STATES, EMAIL_SENT_STATUS, USER_ROLES } from '../../constants/general';

const userSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minLength: 1,
      maxLength: 20,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
    },
    photo: String,
    role: {
      type: String,
      enum: [USER_ROLES.ADMIN, USER_ROLES.USER] as const,
      default: USER_ROLES.USER,
      immutable: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    confirmPassword: {
      type: String,
      select: false,
    },
    changedPasswordAt: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetTokenExpires: {
      type: Date,
      select: false,
    },
    verifyEmailToken: {
      type: String,
      select: false,
    },
    verifyEmailTokenExpires: {
      type: Date,
      select: false,
    },
    accountState: {
      type: String,
      enum: [ACCOUNT_STATES.ACTIVE, ACCOUNT_STATES.INACTIVE] as const,
      default: ACCOUNT_STATES.ACTIVE,
      select: false,
    },
    signupAt: {
      type: Date,
      select: false,
    },
    loginAt: {
      type: Date,
      select: false,
    },
    logoutAt: {
      type: Date,
      select: false,
    },
    accountActivationEmailSentStatus: {
      type: String,
      enum: [
        EMAIL_SENT_STATUS.SUCCESS,
        EMAIL_SENT_STATUS.FAILED,
        EMAIL_SENT_STATUS.PENDING,
      ] as const,
      default: EMAIL_SENT_STATUS.PENDING,
      select: false,
    },
    accountActivationEmailSentAt: {
      type: Date,
      default: null,
      select: false,
    },
    accountInactivationReminderEmailSentStatus: {
      type: String,
      enum: [
        EMAIL_SENT_STATUS.SUCCESS,
        EMAIL_SENT_STATUS.FAILED,
        EMAIL_SENT_STATUS.PENDING,
      ] as const,
      default: EMAIL_SENT_STATUS.PENDING,
      select: false,
    },
    accountInactivationReminderEmailSentAt: {
      type: Date,
      default: null,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
      select: false,
    },
    verifiedAt: {
      type: Date,
      select: false,
    },
    deleteAt: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: [String],
      default: [],
      select: false,
    },
  },
  {
    strict: true,
  },
);

// ***Leaving this code for reference***
// TTL index — only works on Date fields with `expireAfterSeconds`
// userSchema.index({ timeToDeleteAfterSignupWithoutActivation: 1 }, { expireAfterSeconds: 0 });

const SALT_ROUNDS: number = 12 as const;

userSchema.pre(
  /^save/,
  async function (
    this: HydratedDocument<UserSchemaFields>,
    // the next() function in newer versions of mongoose is no longer necessary to be passed as an argument
    // next: (err?: CallbackError) => void
  ) {
    if (this.isNew) {
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);

      // Reassigning the value of confirmPassword to undefined before saving into the database
      // because mongoose does not store undefined values in the database
      this.confirmPassword = undefined;
    } else if (!this.isNew && this.isModified('password')) {
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
      this.changedPasswordAt = new Date();
      this.confirmPassword = undefined;
    }
  },
);

userSchema.methods.correctPassword = async function (
  this: HydratedDocument<UserSchemaFields>,
  candidatePassword: string,
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp: number): boolean {
  if (!this.changedPasswordAt) return false; // returning false means NOT changed
  const changedPasswordTimeInSec = Math.floor((this.changedPasswordAt as Date).getTime() / 1000); // division by 1000 to turn returned time in seconds
  return JWTTimestamp < changedPasswordTimeInSec;
};

userSchema.methods.createPasswordResetToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  this.passwordResetTokenExpires = Date.now() + DURATIONS.PASSWORD_RESET_TOKEN_EXPIRATION_PERIOD;

  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function (expiresIn: number): string {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.verifyEmailToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

  this.verifyEmailTokenExpires = Date.now() + expiresIn;

  return verificationToken;
};

const User = model<UserDocument>('User', userSchema);

export default User;
