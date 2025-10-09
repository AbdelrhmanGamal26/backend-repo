import { HydratedDocument } from 'mongoose';

export interface UserSchemaFields {
  name: string;
  email: string;
  photo?: string;
  password: string;
  role: string;
  confirmPassword?: string;
  changedPasswordAt?: Date;
  passwordResetToken?: string;
  passwordResetTokenExpires?: Date;
  verifyEmailToken?: string;
  verifyEmailTokenExpires?: Date;
  accountState: string;
  signupAt?: Date;
  loginAt?: Date;
  logoutAt?: Date;
  accountActivationEmailSentStatus?: string;
  accountActivationEmailSentAt?: Date;
  accountInactivationReminderEmailSentStatus?: string;
  accountInactivationReminderEmailSentAt?: Date;
  verifiedAt?: Date;
  deletedAt?: Date;
  isVerified: boolean;
  refreshToken: string[];
}

export interface UserInstanceMethods {
  correctPassword(candidatePassword: string): Promise<boolean>;
  changedPasswordAfter(JWTTimestamp: number): boolean;
  createPasswordResetToken(): string;
  createEmailVerificationToken(expiresIn: number): string;
}

export type UserDocument = HydratedDocument<UserSchemaFields, UserInstanceMethods>;

export type CreatedUserType = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};
