import bcryptjs from 'bcryptjs';
import crypto from 'node:crypto';
import {
  HASH_PASSWORD_SALT,
  OTP_LENGTH,
  TEMP_TOKEN_LENGTH,
} from './const.utils';

export function generateHashPassword(password: string): string {
  return bcryptjs.hashSync(password, HASH_PASSWORD_SALT);
}

export function generateOTP(): string {
  return Array.from(
    crypto.randomBytes(OTP_LENGTH),
    (byte) => '0123456789'[byte % 10],
  ).join('');
}

export function generateTempToken(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(
    crypto.randomBytes(TEMP_TOKEN_LENGTH),
    (byte) => chars[byte % chars.length],
  ).join('');
}
