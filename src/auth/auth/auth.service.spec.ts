import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from 'src/email/email/email.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { HttpException } from '@nestjs/common';
import * as generateUtils from 'src/utils/generate.utils';
import { OTP_STATUS } from 'src/utils/const.utils';
import bcrypt from 'bcryptjs';

// ─── Mock Factories ─────────────────────────────────────────────────────────

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  oTP: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  userAuthProvider: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

const mockEmailService = {
  sendOTP: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════════════
  describe('register', () => {
    const registerBody = { email: 'test@example.com' };

    it('should register a new user and send OTP', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      jest.spyOn(generateUtils, 'generateOTP').mockReturnValue('123456');
      mockPrismaService.$transaction.mockResolvedValue([
        {},
        { email: 'test@example.com' },
      ]);
      mockEmailService.sendOTP.mockResolvedValue(undefined);

      const result = await service.register(registerBody);

      expect(result).toEqual({ email: 'test@example.com' });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockEmailService.sendOTP).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
      );
    });

    it('should throw 400 if user already exists with password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        password: 'hashed-password',
      });

      await expect(service.register(registerBody)).rejects.toThrow(
        new HttpException('User already exists', 400),
      );
    });

    it('should throw 409 if user exists but has empty password (OAuth user)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        password: '',
      });

      await expect(service.register(registerBody)).rejects.toThrow(
        new HttpException(
          'Email already registered. Please log in with OAuth or set a password.',
          409,
        ),
      );
    });

    it('should still return email even if sending OTP fails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      jest.spyOn(generateUtils, 'generateOTP').mockReturnValue('654321');
      mockPrismaService.$transaction.mockResolvedValue([
        {},
        { email: 'test@example.com' },
      ]);
      mockEmailService.sendOTP.mockRejectedValue(new Error('SMTP error'));

      const result = await service.register(registerBody);

      expect(result).toEqual({ email: 'test@example.com' });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFY OTP
  // ═══════════════════════════════════════════════════════════════════════════
  describe('verifyOTP', () => {
    const verifyBody = { email: 'test@example.com', otp: '123456' };

    it('should verify OTP and return tempToken', async () => {
      jest
        .spyOn(generateUtils, 'generateTempToken')
        .mockReturnValue('temp-token-123');
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        code: '123456',
        status: OTP_STATUS._ACTIVE,
        expiresAt: new Date(Date.now() + 300000),
      });
      mockPrismaService.oTP.update.mockResolvedValue({});

      const result = await service.verifyOTP(verifyBody);

      expect(result).toEqual({ tempToken: 'temp-token-123' });
      expect(mockPrismaService.oTP.update).toHaveBeenCalledWith({
        where: { id: 'otp-id' },
        data: { status: OTP_STATUS._VERIFIED, tempToken: 'temp-token-123' },
      });
    });

    it('should throw 400 if OTP not found', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue(null);

      await expect(service.verifyOTP(verifyBody)).rejects.toThrow(
        new HttpException('Invalid OTP', 400),
      );
    });

    it('should throw 400 if OTP code does not match', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        code: '999999',
        status: OTP_STATUS._ACTIVE,
        expiresAt: new Date(Date.now() + 300000),
      });

      await expect(service.verifyOTP(verifyBody)).rejects.toThrow(
        new HttpException('Invalid OTP', 400),
      );
    });

    it('should throw 400 if OTP is not active', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        code: '123456',
        status: OTP_STATUS._EXPIRED,
        expiresAt: new Date(Date.now() + 300000),
      });

      await expect(service.verifyOTP(verifyBody)).rejects.toThrow(
        new HttpException('OTP is not active', 400),
      );
    });

    it('should throw 400 if OTP has expired', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        code: '123456',
        status: OTP_STATUS._ACTIVE,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verifyOTP(verifyBody)).rejects.toThrow(
        new HttpException('OTP has expired', 400),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETE PROFILE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('completeProfile', () => {
    const profileBody = {
      name: 'John Doe',
      password: 'password123',
      confirmPassword: 'password123',
    };
    const tempToken = 'valid-temp-token';

    it('should complete profile and create user', async () => {
      const mockUser = {
        id: 'user-id',
        name: 'John Doe',
        email: 'test@example.com',
      };

      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        status: OTP_STATUS._VERIFIED,
        expiresAt: new Date(Date.now() + 300000),
      });
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      jest
        .spyOn(generateUtils, 'generateHashPassword')
        .mockReturnValue('hashed-password');
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          const tx = {
            user: {
              create: jest.fn().mockResolvedValue(mockUser),
            },
            userAuthProvider: {
              create: jest.fn().mockResolvedValue({}),
            },
            oTP: {
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return cb(tx);
        }
      });

      const result = await service.completeProfile(profileBody, tempToken);

      expect(result).toEqual(mockUser);
    });

    it('should throw 400 if tempToken is empty', async () => {
      await expect(service.completeProfile(profileBody, '')).rejects.toThrow(
        new HttpException('Invalid temp token', 400),
      );
    });

    it('should throw 400 if OTP not found for token', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue(null);

      await expect(
        service.completeProfile(profileBody, tempToken),
      ).rejects.toThrow(new HttpException('Invalid token', 400));
    });

    it('should throw 400 if OTP status is not verified', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        status: OTP_STATUS._ACTIVE,
        expiresAt: new Date(Date.now() + 300000),
      });

      await expect(
        service.completeProfile(profileBody, tempToken),
      ).rejects.toThrow(new HttpException('Invalid token', 400));
    });

    it('should throw 400 if OTP is expired and update status', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        status: OTP_STATUS._VERIFIED,
        expiresAt: new Date(Date.now() - 1000),
      });
      mockPrismaService.oTP.update.mockResolvedValue({});

      await expect(
        service.completeProfile(profileBody, tempToken),
      ).rejects.toThrow(new HttpException('Expired token', 400));

      expect(mockPrismaService.oTP.update).toHaveBeenCalledWith({
        where: { id: 'otp-id' },
        data: { status: OTP_STATUS._EXPIRED },
      });
    });

    it('should throw 400 if user already exists', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        status: OTP_STATUS._VERIFIED,
        expiresAt: new Date(Date.now() + 300000),
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user',
      });

      await expect(
        service.completeProfile(profileBody, tempToken),
      ).rejects.toThrow(new HttpException('User already exists', 400));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════
  describe('login', () => {
    const loginBody = { email: 'test@example.com', password: 'password123' };

    it('should login and return JWT token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        name: 'John Doe',
        email: 'test@example.com',
        password: bcrypt.hashSync('password123', 10),
        userAuthProvider: [{ provider: 'local', providerUserId: 'user-id' }],
        createdAt: new Date(),
        deletedAt: null,
      });

      const result = await service.login(loginBody);

      expect(result).toEqual({ token: 'mock-jwt-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        id: 'user-id',
        email: 'test@example.com',
        userAuthProvider: { provider: 'local', providerUserId: 'user-id' },
      });
    });

    it('should throw 404 if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginBody)).rejects.toThrow(
        new HttpException('User not found', 404),
      );
    });

    it('should throw 409 if user has empty password (OAuth only)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: '',
        userAuthProvider: [],
      });

      await expect(service.login(loginBody)).rejects.toThrow(
        new HttpException(
          'This account was created using OAuth. Please log in with OAuth or set a password.',
          409,
        ),
      );
    });

    it('should throw 400 if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: bcrypt.hashSync('different-password', 10),
        userAuthProvider: [{ provider: 'local', providerUserId: 'user-id' }],
      });

      await expect(service.login(loginBody)).rejects.toThrow(
        new HttpException('Invalid password', 400),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OAUTH LOGIN CALLBACK
  // ═══════════════════════════════════════════════════════════════════════════
  describe('oauthLoginCallback', () => {
    const oauthUser = {
      email: 'oauth@example.com',
      firstName: 'OAuth',
      provider: 'google',
      providerId: 'google-123',
    };

    it('should create new user if user does not exist', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'oauth@example.com',
        name: 'OAuth',
        userAuthProvider: [
          { provider: 'google', providerUserId: 'google-123' },
        ],
      });

      const result = await service.oauthLoginCallback(oauthUser);

      expect(result).toEqual({ token: 'mock-jwt-token' });
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should link existing user with new OAuth provider', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'existing-user-id',
        email: 'oauth@example.com',
        name: 'OAuth User',
        userAuthProvider: [
          { provider: 'local', providerUserId: 'existing-user-id' },
        ],
      });
      mockPrismaService.userAuthProvider.findFirst.mockResolvedValue(null);
      mockPrismaService.userAuthProvider.create.mockResolvedValue({
        provider: 'google',
        providerUserId: 'google-123',
      });

      const result = await service.oauthLoginCallback(oauthUser);

      expect(result).toEqual({ token: 'mock-jwt-token' });
      expect(mockPrismaService.userAuthProvider.create).toHaveBeenCalled();
    });

    it('should use existing provider link if already linked', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'existing-user-id',
        email: 'oauth@example.com',
        name: 'OAuth User',
        userAuthProvider: [
          { provider: 'google', providerUserId: 'google-123' },
        ],
      });
      mockPrismaService.userAuthProvider.findFirst.mockResolvedValue({
        provider: 'google',
        providerUserId: 'google-123',
      });

      const result = await service.oauthLoginCallback(oauthUser);

      expect(result).toEqual({ token: 'mock-jwt-token' });
      expect(mockPrismaService.userAuthProvider.create).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SET PASSWORD OTP
  // ═══════════════════════════════════════════════════════════════════════════
  describe('setPasswordOTP', () => {
    it('should send OTP for set_password if user has empty password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        password: '',
      });
      jest.spyOn(generateUtils, 'generateOTP').mockReturnValue('111111');
      mockPrismaService.$transaction.mockResolvedValue([
        {},
        { email: 'test@example.com' },
      ]);

      const result = await service.setPasswordOTP('test@example.com');

      expect(result).toEqual({ email: 'test@example.com' });
    });

    it('should send OTP for forgot_password if user has password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        password: 'hashed',
      });
      jest.spyOn(generateUtils, 'generateOTP').mockReturnValue('222222');
      mockPrismaService.$transaction.mockResolvedValue([
        {},
        { email: 'test@example.com' },
      ]);

      const result = await service.setPasswordOTP('test@example.com');

      expect(result).toEqual({ email: 'test@example.com' });
    });

    it('should throw 404 if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.setPasswordOTP('unknown@example.com'),
      ).rejects.toThrow(new HttpException('User not found', 404));
    });

    it('should still return email even if sending OTP fails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        password: 'hashed',
      });
      jest.spyOn(generateUtils, 'generateOTP').mockReturnValue('333333');
      mockPrismaService.$transaction.mockResolvedValue([
        {},
        { email: 'test@example.com' },
      ]);
      mockEmailService.sendOTP.mockRejectedValue(new Error('SMTP down'));

      const result = await service.setPasswordOTP('test@example.com');

      expect(result).toEqual({ email: 'test@example.com' });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SET PASSWORD
  // ═══════════════════════════════════════════════════════════════════════════
  describe('setPassword', () => {
    const setPasswordBody = {
      password: 'newPassword123',
      confirmPassword: 'newPassword123',
    };
    const tempToken = 'valid-temp-token';

    it('should set password and return JWT token', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        status: OTP_STATUS._VERIFIED,
        expiresAt: new Date(Date.now() + 300000),
      });
      jest
        .spyOn(generateUtils, 'generateHashPassword')
        .mockReturnValue('new-hashed-password');
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          const tx = {
            user: {
              update: jest.fn().mockResolvedValue({
                id: 'user-id',
                email: 'test@example.com',
                password: 'new-hashed-password',
              }),
            },
            userAuthProvider: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'provider-id',
                provider: 'local',
                providerUserId: 'user-id',
                userId: 'user-id',
              }),
            },
            oTP: {
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return cb(tx);
        }
      });

      const result = await service.setPassword(setPasswordBody, tempToken);

      expect(result).toEqual({ token: 'mock-jwt-token' });
    });

    it('should throw 400 if tempToken is empty', async () => {
      await expect(service.setPassword(setPasswordBody, '')).rejects.toThrow(
        new HttpException('Invalid temp token', 400),
      );
    });

    it('should throw 400 if OTP not found', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue(null);

      await expect(
        service.setPassword(setPasswordBody, tempToken),
      ).rejects.toThrow(new HttpException('Invalid token', 400));
    });

    it('should throw 400 if OTP status is not verified', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        status: OTP_STATUS._ACTIVE,
        expiresAt: new Date(Date.now() + 300000),
      });

      await expect(
        service.setPassword(setPasswordBody, tempToken),
      ).rejects.toThrow(new HttpException('Invalid token', 400));
    });

    it('should throw 400 if OTP is expired', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        status: OTP_STATUS._VERIFIED,
        expiresAt: new Date(Date.now() - 1000),
      });
      mockPrismaService.oTP.update.mockResolvedValue({});

      await expect(
        service.setPassword(setPasswordBody, tempToken),
      ).rejects.toThrow(new HttpException('Expired token', 400));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════════════
  describe('logout', () => {
    it('should return success message', async () => {
      const result = await service.logout();

      expect(result).toEqual({ message: 'User logged out successfully' });
    });
  });
});
