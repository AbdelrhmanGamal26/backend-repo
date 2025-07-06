export const forgotPasswordEmailTemplate =
  '<p>Hi {{name}},</p>' +
  '<p>Forgot your password? Please click the link below to be redirected ' +
  'to the password change form</p>' +
  '<a href="{{resetURL}}">Click here</a>' +
  "<p>if you didn't forget your password, please ignore this email.</p>";

export const accountDeletionReminderEmailTemplate =
  '<p>Hi {{name}},</p>' +
  '<p>We noticed your account is scheduled for deletion in 3 days.</p>' +
  "<p>If you want to keep your account, please activate it before it's permanently removed.</p>" +
  '<p>Thank you,</p>' +
  '<p>The [App Name] Team</p>';

export const resendVerificationEmailTemplate =
  '<p>Hi {{name}},</p>' +
  '<p>Thank you for registering with [App Name]!</p>' +
  '<p>Please verify your email address by clicking the link below. ' +
  'This helps us ensure the security of your account.</p>' +
  '<p>Verify your email:</p> <a href="{{verificationUrl}}">Click here</a>' +
  '<p>This link will expire in 1 hour.</p>' +
  "<p>If you didn't create an account, you can safely ignore this email.</p>" +
  '<p>Thank you,</p>' +
  '<p>The [App Name] Team</p>';

export const emailVerificationEmailTemplate =
  '<p>Hi {{name}},</p>' +
  '<p>Thanks for signing up! Please confirm your email by clicking the link below:</p>' +
  '<a href="{{verificationUrl}}">Click here</a>' +
  "<p>If you didn't create this account, you can safely ignore this message.</p>" +
  '<p>Thank you,</p>' +
  '<p>The [App Name] Team</p>';
