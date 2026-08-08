import {
  generateHashPassword,
  generateOTP,
  generatePersonalAccessToken,
  generateTempToken,
  hashPersonalAccessToken,
} from './generate.utils';
import { OTP_LENGTH, PAT_PREFIX, TEMP_TOKEN_LENGTH } from './const.utils';
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

describe('personal access tokens', () => {
  describe('generatePersonalAccessToken', () => {
    it('should carry the aur_pat_ prefix so it is recognisable in config files', () => {
      expect(generatePersonalAccessToken().startsWith(PAT_PREFIX)).toBe(true);
    });

    it('should be URL-safe so it can sit in a header or YAML value unquoted', () => {
      const body = generatePersonalAccessToken().slice(PAT_PREFIX.length);
      expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should carry at least 32 bytes of entropy', () => {
      // base64url of 32 bytes is 43 characters.
      const body = generatePersonalAccessToken().slice(PAT_PREFIX.length);
      expect(body.length).toBeGreaterThanOrEqual(43);
    });

    it('should never repeat', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 200; i++) {
        tokens.add(generatePersonalAccessToken());
      }
      expect(tokens.size).toBe(200);
    });
  });

  describe('hashPersonalAccessToken', () => {
    it('should be deterministic so the hash can be looked up by index', () => {
      const token = generatePersonalAccessToken();
      expect(hashPersonalAccessToken(token)).toBe(
        hashPersonalAccessToken(token),
      );
    });

    it('should produce a hex sha256 digest', () => {
      expect(hashPersonalAccessToken('anything')).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should not leak the token itself', () => {
      const token = generatePersonalAccessToken();
      expect(hashPersonalAccessToken(token)).not.toContain(
        token.slice(PAT_PREFIX.length),
      );
    });

    it('should differ for different tokens', () => {
      expect(hashPersonalAccessToken('a')).not.toBe(
        hashPersonalAccessToken('b'),
      );
    });
  });
});
