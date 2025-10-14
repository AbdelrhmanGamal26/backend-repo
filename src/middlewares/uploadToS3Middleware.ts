import { PutObjectCommand } from '@aws-sdk/client-s3';
import s3 from '../utils/s3Client';

export const uploadToS3 = async (file: Express.Multer.File) => {
  const fileName = `users/${Date.now()}-${file.originalname}`;

  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await s3.send(new PutObjectCommand(uploadParams));

  const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

  return fileUrl;
};
