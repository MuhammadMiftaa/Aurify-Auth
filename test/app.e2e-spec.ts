import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { AuthController } from './../src/auth/auth/auth.controller';
import { AuthService } from './../src/auth/auth/auth.service';
import { PrismaService } from './../src/prisma/prisma/prisma.service';
import { EmailService } from './../src/email/email/email.service';
import { ValidationFilter } from './../src/validation/validation.filter';
import { ValidationService } from './../src/validation/validation/validation.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ProfileGrpcService } from './../src/grpc/profile/profile-grpc.service';

// ─── Mock Factories ──────────────────────────────────────────────────────────

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
  sendOTP: jest.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('http://localhost:5173'),
};

const mockProfileGrpcService = {
  createProfile: jest.fn().mockResolvedValue({
    id: 'profile-id',
    user_id: 'user-id',
    fullname: 'Test User',
    photo_url: '',
    created_at: '',
    updated_at: '',
  }),
};

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, AuthController],
      providers: [
        AppService,
        AuthService,
        ValidationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ProfileGrpcService, useValue: mockProfileGrpcService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ValidationFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Health Check
  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /test', () => {
    it('should return Hello World', () => {
      return request(app.getHttpServer())
        .get('/test')
        .expect(200)
        .expect({ message: 'Hello World' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/register
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /auth/register', () => {
    it('should register and return 201 with email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockResolvedValue([
        {},
        { email: 'test@example.com' },
      ]);

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@example.com' })
        .expect(201);

      expect(res.body).toEqual({
        status: true,
        statusCode: 200,
        message: 'Registration successful, please verify your email',
        data: { email: 'test@example.com' },
      });
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email' })
        .expect(400);

      expect(res.body.status).toBe(false);
      expect(res.body.message).toBe('Validation failed');
    });

    it('should return 400 for missing email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({})
        .expect(400);

      expect(res.body.status).toBe(false);
    });

    it('should return 400 if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'test@example.com',
        password: 'hashed',
      });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(res.body.message).toBe('User already exists');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/verify-otp
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /auth/verify-otp', () => {
    it('should verify OTP and return tempToken', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        code: '123456',
        status: 'active',
        expiresAt: new Date(Date.now() + 300000),
      });
      mockPrismaService.oTP.update.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ email: 'test@example.com', otp: '123456' })
        .expect(201);

      expect(res.body.status).toBe(true);
      expect(res.body.data).toHaveProperty('tempToken');
    });

    it('should return 400 for invalid OTP format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ email: 'test@example.com', otp: '12' })
        .expect(400);

      expect(res.body.status).toBe(false);
    });

    it('should return 400 for wrong OTP', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        code: '999999',
        status: 'active',
        expiresAt: new Date(Date.now() + 300000),
      });

      const res = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ email: 'test@example.com', otp: '123456' })
        .expect(400);

      expect(res.body.message).toBe('Invalid OTP');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/complete-profile
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /auth/complete-profile', () => {
    it('should complete profile and return JWT token', async () => {
      mockPrismaService.oTP.findFirst.mockResolvedValue({
        id: 'otp-id',
        email: 'test@example.com',
        status: 'verified',
        expiresAt: new Date(Date.now() + 300000),
      });
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        if (typeof cb === 'function') {
          const tx = {
            user: {
              create: jest.fn().mockResolvedValue({
                id: 'user-id',
                name: 'Test User',
                email: 'test@example.com',
              }),
            },
            userAuthProvider: { create: jest.fn().mockResolvedValue({}) },
            oTP: { update: jest.fn().mockResolvedValue({}) },
          };
          return cb(tx);
        }
      });

      const res = await request(app.getHttpServer())
        .post('/auth/complete-profile?tempToken=valid-token')
        .send({
          name: 'Test User',
          password: 'password123',
          confirmPassword: 'password123',
        })
        .expect(201);

      expect(res.body.status).toBe(true);
      expect(res.body.message).toBe('Profile completed successfully');
      expect(res.body.data).toHaveProperty('token');
    });

    it('should return 400 for missing tempToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/complete-profile')
        .send({
          name: 'Test User',
          password: 'password123',
          confirmPassword: 'password123',
        })
        .expect(400);

      expect(res.body.message).toBe('Invalid temp token');
    });

    it('should return 400 for password mismatch', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/complete-profile?tempToken=some-token')
        .send({
          name: 'Test User',
          password: 'password123',
          confirmPassword: 'different',
        })
        .expect(400);

      expect(res.body.status).toBe(false);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/login
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /auth/login', () => {
    it('should return 400 for invalid login payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'bad', password: '12' })
        .expect(400);

      expect(res.body.status).toBe(false);
      expect(res.body.message).toBe('Validation failed');
    });

    it('should return 404 for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'noone@example.com', password: 'password123' })
        .expect(404);

      expect(res.body.message).toBe('User not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/request-set-password
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /auth/request-set-password', () => {
    it('should return 400 for invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/request-set-password')
        .send({ email: 'invalid' })
        .expect(400);

      expect(res.body.status).toBe(false);
    });

    it('should return 404 if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/auth/request-set-password')
        .send({ email: 'noone@example.com' })
        .expect(404);

      expect(res.body.message).toBe('User not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/set-password
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /auth/set-password', () => {
    it('should return 400 for invalid payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/set-password')
        .send({ password: '12', confirmPassword: '34' })
        .expect(400);

      expect(res.body.status).toBe(false);
    });

    it('should return 400 for missing tempToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/set-password')
        .send({ password: 'newpass123', confirmPassword: 'newpass123' })
        .expect(400);

      expect(res.body.message).toBe('Invalid temp token');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /auth/logout
  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /auth/logout', () => {
    it('should return logout success message', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(201);

      expect(res.body).toHaveProperty('message', 'User logged out successfully');
    });
  });
});