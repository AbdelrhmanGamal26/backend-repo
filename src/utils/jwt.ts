import { Types } from 'mongoose';
import ms, { StringValue } from 'ms';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { validateEnvVar } from './generalUtils';

export const generateToken = (data: Types.ObjectId | string) => {
  const jwtSecret = validateEnvVar(process.env.JWT_SECRET, 'JWT_SECRET');
  const jwtExpirationPeriod = ms(
    validateEnvVar(process.env.JWT_EXPIRES_IN, 'JWT_EXPIRES_IN') as StringValue,
  );

  return jwt.sign({ data }, jwtSecret, {
    expiresIn: jwtExpirationPeriod,
  });
};

export const verifyToken = (token: string) => {
  const jwtSecret = validateEnvVar(process.env.JWT_SECRET, 'JWT_SECRET');
  return jwt.verify(token, jwtSecret) as JwtPayload;
};
