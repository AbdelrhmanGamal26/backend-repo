import { Types } from 'mongoose';
import ms, { StringValue } from 'ms';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { validateEnvVar } from './generalUtils';

export const generateToken = (
  data: Types.ObjectId | string,
  secretName: string,
  expiration: string,
) => {
  const jwtSecret = validateEnvVar(process.env[secretName], secretName);
  const jwtExpirationPeriod = ms(
    validateEnvVar(process.env[expiration], expiration) as StringValue,
  );

  return jwt.sign({ data }, jwtSecret, {
    expiresIn: jwtExpirationPeriod,
  });
};

export const verifyToken = (token: string, secretName: string) => {
  const jwtSecret = validateEnvVar(process.env[secretName], secretName);
  return jwt.verify(token, jwtSecret) as JwtPayload;
};
