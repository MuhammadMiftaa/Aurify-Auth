import bcryptjs from 'bcryptjs';
import crypto from 'node:crypto';
import {
  HASH_PASSWORD_SALT,
  OTP_LENGTH,
  PAT_BYTES,
  PAT_PREFIX,
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

/**
 * Generates a personal access token. Returned in full exactly once at creation;
 * only the hash is persisted.
 */
export function generatePersonalAccessToken(): string {
  return PAT_PREFIX + crypto.randomBytes(PAT_BYTES).toString('base64url');
}

/**
 * Hashes a personal access token for storage and lookup. SHA-256 rather than
 * bcrypt: the input is 256 bits of entropy, so there is nothing to brute-force,
 * and a deterministic digest allows an indexed lookup instead of scanning every
 * row on each exchange.
 */
export function hashPersonalAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
