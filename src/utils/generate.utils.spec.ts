import {
  generateHashPassword,
  generateOTP,
  generateTempToken,
} from './generate.utils';
import { OTP_LENGTH, TEMP_TOKEN_LENGTH } from './const.utils';
import bcryptjs from 'bcryptjs';

describe('Generate Utils', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // generateHashPassword
  // ═══════════════════════════════════════════════════════════════════════════
  describe('generateHashPassword', () => {
    it('should return a hashed password', () => {
      const password = 'myPassword123';
      const hashed = generateHashPassword(password);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(bcryptjs.compareSync(password, hashed)).toBe(true);
    });

    it('should return different hashes for the same password (salt)', () => {
      const password = 'testPassword';
      const hash1 = generateHashPassword(password);
      const hash2 = generateHashPassword(password);

      // Bcrypt uses random salt, so hashes should differ
      expect(hash1).not.toBe(hash2);
      // But both should be valid
      expect(bcryptjs.compareSync(password, hash1)).toBe(true);
      expect(bcryptjs.compareSync(password, hash2)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // generateOTP
  // ═══════════════════════════════════════════════════════════════════════════
  describe('generateOTP', () => {
    it('should generate OTP with correct length', () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(OTP_LENGTH);
    });

    it('should contain only digits', () => {
      const otp = generateOTP();
      expect(otp).toMatch(/^\d+$/);
    });

    it('should generate different OTPs on subsequent calls', () => {
      const otps = new Set<string>();
      for (let i = 0; i < 50; i++) {
        otps.add(generateOTP());
      }
      // At least some should be different (probabilistically near certain)
      expect(otps.size).toBeGreaterThan(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // generateTempToken
  // ═══════════════════════════════════════════════════════════════════════════
  describe('generateTempToken', () => {
    it('should generate token with correct length', () => {
      const token = generateTempToken();
      expect(token).toHaveLength(TEMP_TOKEN_LENGTH);
    });

    it('should contain only alphanumeric characters', () => {
      const token = generateTempToken();
      expect(token).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate different tokens on subsequent calls', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 50; i++) {
        tokens.add(generateTempToken());
      }
      expect(tokens.size).toBeGreaterThan(1);
    });
  });
});
