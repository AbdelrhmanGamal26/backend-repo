import nodemailer from 'nodemailer';

interface sendEmailOptionsType {
  email: string;
  subject: string;
  message: string;
}

const sendEmail = async (options: sendEmailOptionsType) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const emailOptions = {
    from: 'test <test@gmail.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  await transporter.sendMail(emailOptions);
};

export default sendEmail;
