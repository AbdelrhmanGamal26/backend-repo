import { HydratedDocument } from 'mongoose';

export interface UserSchemaFields {
  name: string;
  role: string;
  email: string;
  photo?: string;
  loginAt?: Date;
  signupAt?: Date;
  logoutAt?: Date;
  password: string;
  deletedAt?: Date;
  verifiedAt?: Date;
  isVerified: boolean;
  accountState: string;
  refreshToken: string[];
  photoPublicId?: string;
  confirmPassword?: string;
  changedPasswordAt?: Date;
  verifyEmailToken?: string;
  passwordResetToken?: string;
  verifyEmailTokenExpires?: Date;
  passwordResetTokenExpires?: Date;
  accountActivationEmailSentAt?: Date;
  accountActivationEmailSentStatus?: string;
  accountInactivationReminderEmailSentAt?: Date;
  accountInactivationReminderEmailSentStatus?: string;
}

export interface UserInstanceMethods {
  createPasswordResetToken(): string;
  changedPasswordAfter(JWTTimestamp: number): boolean;
  createEmailVerificationToken(expiresIn: number): string;
  correctPassword(candidatePassword: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<UserSchemaFields, UserInstanceMethods>;

export type CreatedUserType = {
  name: string;
  email: string;
  photo?: string;
  password: string;
  confirmPassword: string;
};
