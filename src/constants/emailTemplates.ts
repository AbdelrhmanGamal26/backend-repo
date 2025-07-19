export const accountVerificationEmailTemplate =
  '<p>Hi {{name}},</p>' +
  '<p>Thanks for signing up! Please confirm your email by clicking the link below:</p>' +
  '<a href="{{verificationUrl}}">Click here</a>' +
  "<p>If you didn't create this account, you can safely ignore this message.</p>" +
  '<p>Thank you,</p>' +
  '<p>The [App Name] Team</p>';

export const forgotPasswordEmailTemplate =
  '<p>Hi {{name}},</p>' +
  '<p>Forgot your password? Please click the link below to be redirected ' +
  'to the password change form</p>' +
  '<a href="{{resetURL}}">Click here</a>' +
  "<p>if you didn't forget your password, please ignore this email.</p>" +
  '<p>The [App Name] Team</p>';

export const accountDeletionReminderEmailTemplate =
  '<p>Hi {{name}},</p>' +
  '<p>We noticed your account is scheduled for deletion in {{remainingPeriod}} days.</p>' +
  "<p>If you want to keep your account, please activate it before it's permanently removed.</p>" +
  '<p>Thank you,</p>' +
  '<p>The [App Name] Team</p>';

export const accountDeletionEmailTemplate =
  '<p>Hi {{name}},</p>' +
  '<p>We want to inform you that your account has been permanently removed.</p>' +
  '<p>We hope you enjoyed using our application.</p>' +
  '<p>Thank you,</p>' +
  '<p>The [App Name] Team</p>';
