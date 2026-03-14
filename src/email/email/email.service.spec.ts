import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as nodemailer from 'nodemailer';

// ─── Mock nodemailer ─────────────────────────────────────────────────────────

jest.mock('nodemailer');

const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockTransporter = {
  sendMail: mockSendMail,
  verify: mockVerify,
};

(nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string | number> = {
      EMAIL_HOST: 'smtp.example.com',
      EMAIL_PORT: 587,
      EMAIL_SECURE: 0,
      EMAIL_USER: 'user@example.com',
      EMAIL_PASSWORD: 'password',
    };
    return config[key];
  }),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // sendOTP
  // ═══════════════════════════════════════════════════════════════════════════
  describe('sendOTP', () => {
    it('should send OTP email successfully', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-1' });

      await service.sendOTP('test@example.com', '123456');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('OTP email sent successfully'),
      );
    });

    it('should throw error if sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP failure'));

      await expect(
        service.sendOTP('test@example.com', '123456'),
      ).rejects.toThrow('Failed to send OTP email');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // verifyConnection
  // ═══════════════════════════════════════════════════════════════════════════
  describe('verifyConnection', () => {
    it('should return true if transporter verifies', async () => {
      mockVerify.mockResolvedValue(true);

      const result = await service.verifyConnection();

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Email server is ready to send messages',
      );
    });

    it('should return false if transporter verification fails', async () => {
      mockVerify.mockRejectedValue(new Error('Connection refused'));

      const result = await service.verifyConnection();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Email server connection failed:',
        expect.any(Error),
      );
    });
  });
});
