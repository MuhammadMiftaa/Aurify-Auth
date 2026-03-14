import { registerRequestValidation } from './register.model';
import { loginRequestValidation } from './login.model';
import { verifyOTPRequestValidation } from './verify-otp.model';
import { completeProfileRequestValidation } from './complete-profile.model';
import { setPasswordRequestValidation } from './set-password.model';
import { requestSetPasswordValidation } from './request-set-password.model';
import { ZodError } from 'zod';

describe('Model Validations', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // RegisterRequest
  // ═══════════════════════════════════════════════════════════════════════════
  describe('registerRequestValidation', () => {
    it('should pass with valid email', () => {
      const result = registerRequestValidation.parse({
        email: 'test@example.com',
      });
      expect(result.email).toBe('test@example.com');
    });

    it('should fail with invalid email', () => {
      expect(() =>
        registerRequestValidation.parse({ email: 'not-email' }),
      ).toThrow(ZodError);
    });

    it('should fail with missing email', () => {
      expect(() => registerRequestValidation.parse({})).toThrow(ZodError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LoginRequest
  // ═══════════════════════════════════════════════════════════════════════════
  describe('loginRequestValidation', () => {
    it('should pass with valid email and password', () => {
      const result = loginRequestValidation.parse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('password123');
    });

    it('should fail with invalid email', () => {
      expect(() =>
        loginRequestValidation.parse({
          email: 'invalid',
          password: 'password123',
        }),
      ).toThrow(ZodError);
    });

    it('should fail with password too short', () => {
      expect(() =>
        loginRequestValidation.parse({
          email: 'test@example.com',
          password: '123',
        }),
      ).toThrow(ZodError);
    });

    it('should fail with missing fields', () => {
      expect(() => loginRequestValidation.parse({})).toThrow(ZodError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VerifyOTPRequest
  // ═══════════════════════════════════════════════════════════════════════════
  describe('verifyOTPRequestValidation', () => {
    it('should pass with valid email and 6-digit OTP', () => {
      const result = verifyOTPRequestValidation.parse({
        email: 'test@example.com',
        otp: '123456',
      });
      expect(result.otp).toBe('123456');
    });

    it('should fail with OTP too short', () => {
      expect(() =>
        verifyOTPRequestValidation.parse({
          email: 'test@example.com',
          otp: '123',
        }),
      ).toThrow(ZodError);
    });

    it('should fail with OTP too long', () => {
      expect(() =>
        verifyOTPRequestValidation.parse({
          email: 'test@example.com',
          otp: '1234567',
        }),
      ).toThrow(ZodError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CompleteProfileRequest
  // ═══════════════════════════════════════════════════════════════════════════
  describe('completeProfileRequestValidation', () => {
    it('should pass with valid data', () => {
      const result = completeProfileRequestValidation.parse({
        name: 'John Doe',
        password: 'password123',
        confirmPassword: 'password123',
      });
      expect(result.name).toBe('John Doe');
    });

    it('should fail if passwords do not match', () => {
      expect(() =>
        completeProfileRequestValidation.parse({
          name: 'John Doe',
          password: 'password123',
          confirmPassword: 'different',
        }),
      ).toThrow(ZodError);
    });

    it('should fail if name is too short', () => {
      expect(() =>
        completeProfileRequestValidation.parse({
          name: 'J',
          password: 'password123',
          confirmPassword: 'password123',
        }),
      ).toThrow(ZodError);
    });

    it('should fail if password is too short', () => {
      expect(() =>
        completeProfileRequestValidation.parse({
          name: 'John Doe',
          password: '123',
          confirmPassword: '123',
        }),
      ).toThrow(ZodError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SetPasswordRequest
  // ═══════════════════════════════════════════════════════════════════════════
  describe('setPasswordRequestValidation', () => {
    it('should pass with matching passwords', () => {
      const result = setPasswordRequestValidation.parse({
        password: 'newPassword123',
        confirmPassword: 'newPassword123',
      });
      expect(result.password).toBe('newPassword123');
    });

    it('should fail if passwords do not match', () => {
      expect(() =>
        setPasswordRequestValidation.parse({
          password: 'newPassword123',
          confirmPassword: 'different',
        }),
      ).toThrow(ZodError);
    });

    it('should fail if password is too short', () => {
      expect(() =>
        setPasswordRequestValidation.parse({
          password: '123',
          confirmPassword: '123',
        }),
      ).toThrow(ZodError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RequestSetPasswordRequest
  // ═══════════════════════════════════════════════════════════════════════════
  describe('requestSetPasswordValidation', () => {
    it('should pass with valid email', () => {
      const result = requestSetPasswordValidation.parse({
        email: 'test@example.com',
      });
      expect(result.email).toBe('test@example.com');
    });

    it('should fail with invalid email', () => {
      expect(() =>
        requestSetPasswordValidation.parse({ email: 'not-email' }),
      ).toThrow(ZodError);
    });
  });
});
