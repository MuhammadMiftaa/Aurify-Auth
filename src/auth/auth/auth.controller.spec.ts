import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';

// ─── Mock AuthService ────────────────────────────────────────────────────────

const mockAuthService = {
  register: jest.fn(),
  verifyOTP: jest.fn(),
  completeProfile: jest.fn(),
  login: jest.fn(),
  oauthLoginCallback: jest.fn(),
  setPasswordOTP: jest.fn(),
  setPassword: jest.fn(),
  logout: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('http://localhost:5173'),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/register
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /register', () => {
    it('should return success response on register', async () => {
      mockAuthService.register.mockResolvedValue({
        email: 'test@example.com',
      });

      const result = await controller.register({ email: 'test@example.com' });

      expect(result).toEqual({
        status: true,
        statusCode: 200,
        message: 'Registration successful, please verify your email',
        data: { email: 'test@example.com' },
      });
      expect(mockAuthService.register).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/verify-otp
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /verify-otp', () => {
    it('should return success response with tempToken', async () => {
      mockAuthService.verifyOTP.mockResolvedValue({
        tempToken: 'temp-token-123',
      });

      const result = await controller.verifyOTP({
        email: 'test@example.com',
        otp: '123456',
      });

      expect(result).toEqual({
        status: true,
        statusCode: 200,
        message: 'OTP verified successfully',
        data: { tempToken: 'temp-token-123' },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/complete-profile
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /complete-profile', () => {
    it('should return success response with user data', async () => {
      const mockUser = {
        id: 'user-id',
        name: 'John Doe',
        email: 'test@example.com',
      };
      mockAuthService.completeProfile.mockResolvedValue(mockUser);

      const result = await controller.completeProfile(
        {
          name: 'John Doe',
          password: 'password123',
          confirmPassword: 'password123',
        },
        'temp-token-123',
      );

      expect(result).toEqual({
        status: true,
        statusCode: 200,
        message: 'Profile completed successfully',
        data: mockUser,
      });
      expect(mockAuthService.completeProfile).toHaveBeenCalledWith(
        {
          name: 'John Doe',
          password: 'password123',
          confirmPassword: 'password123',
        },
        'temp-token-123',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/login
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /login', () => {
    it('should return success response with token', async () => {
      mockAuthService.login.mockResolvedValue({ token: 'jwt-token' });

      const result = await controller.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        status: true,
        statusCode: 200,
        message: 'Login successful',
        data: { token: 'jwt-token' },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /auth/google/callback
  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /google/callback', () => {
    it('should redirect with token from oauth callback', async () => {
      mockAuthService.oauthLoginCallback.mockResolvedValue({
        token: 'google-jwt-token',
      });
      mockConfigService.get.mockReturnValue('http://localhost:5173');

      const mockReq = {
        user: {
          email: 'oauth@example.com',
          firstName: 'Google',
          provider: 'google',
          providerId: 'g-123',
        },
      } as any;

      const result = await controller.googleLoginCallback(mockReq);

      expect(result).toEqual({
        url: 'http://localhost:5173#aurify_token=google-jwt-token',
        statusCode: 302,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /auth/github/callback
  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /github/callback', () => {
    it('should redirect with token from oauth callback', async () => {
      mockAuthService.oauthLoginCallback.mockResolvedValue({
        token: 'github-jwt-token',
      });
      mockConfigService.get.mockReturnValue('http://localhost:5173');

      const mockReq = {
        user: {
          email: 'oauth@example.com',
          username: 'githubuser',
          provider: 'github',
          providerId: 'gh-123',
        },
      } as any;

      const result = await controller.githubLoginCallback(mockReq);

      expect(result).toEqual({
        url: 'http://localhost:5173#aurify_token=github-jwt-token',
        statusCode: 302,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /auth/microsoft/callback
  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /microsoft/callback', () => {
    it('should redirect with token from oauth callback', async () => {
      mockAuthService.oauthLoginCallback.mockResolvedValue({
        token: 'ms-jwt-token',
      });
      mockConfigService.get.mockReturnValue('http://localhost:5173');

      const mockReq = {
        user: {
          email: 'oauth@example.com',
          name: 'Microsoft User',
          provider: 'microsoft',
          providerId: 'ms-123',
        },
      } as any;

      const result = await controller.microsoftLoginCallback(mockReq);

      expect(result).toEqual({
        url: 'http://localhost:5173#aurify_token=ms-jwt-token',
        statusCode: 302,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/request-set-password
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /request-set-password', () => {
    it('should return success response with OTP sent', async () => {
      mockAuthService.setPasswordOTP.mockResolvedValue({
        email: 'test@example.com',
      });

      const result = await controller.requestSetPassword({
        email: 'test@example.com',
      });

      expect(result).toEqual({
        status: true,
        statusCode: 200,
        message: 'OTP sent successfully',
        data: { email: 'test@example.com' },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/set-password
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /set-password', () => {
    it('should return success response with token', async () => {
      mockAuthService.setPassword.mockResolvedValue({
        token: 'new-jwt-token',
      });

      const result = await controller.setPassword(
        { password: 'newpass123', confirmPassword: 'newpass123' },
        'temp-token-123',
      );

      expect(result).toEqual({
        status: true,
        statusCode: 200,
        message: 'Password set successfully',
        data: { token: 'new-jwt-token' },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/logout
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /logout', () => {
    it('should return logout result', () => {
      mockAuthService.logout.mockReturnValue({
        message: 'User logged out successfully',
      });

      const result = controller.logout();

      expect(result).toEqual({ message: 'User logged out successfully' });
    });
  });
});
