import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { HydratedDocument, Schema, model } from 'mongoose';
import { UserDocument, UserSchemaFields } from '../../@types/userTypes';

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
      enum: ['admin', 'user'],
      default: 'user',
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
      enum: ['active', 'inactive'],
      default: 'active',
      select: false,
    },
    signupAt: {
      type: Date,
      select: false,
    },
    timeToDeleteAfterSignupWithoutActivation: {
      type: Date,
      select: false,
    },
    loginAt: {
      type: Date,
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
  },
  {
    strict: true,
  },
);

// TTL index — only works on Date fields with `expireAfterSeconds`
userSchema.index({ timeToDeleteAfterSignupWithoutActivation: 1 }, { expireAfterSeconds: 0 });

const SALT_ROUNDS: number = 12;

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

  this.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000;

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
