import { PrismaService } from './prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

// ─── Mock pg Pool and PrismaPg ──────────────────────────────────────────────

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('generated/prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    constructor() {}
    $connect = jest.fn().mockResolvedValue(undefined);
    $disconnect = jest.fn().mockResolvedValue(undefined);
    $queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
  },
}));

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
    service = new (PrismaService as any)(mockLogger);
    // Manually attach mocked methods since constructor is mocked
    service.$connect = jest.fn().mockResolvedValue(undefined);
    service.$disconnect = jest.fn().mockResolvedValue(undefined);
    service.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    // Attach logger manually since mock overrides constructor
    (service as any).logger = mockLogger;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // onModuleInit
  // ═══════════════════════════════════════════════════════════════════════════
  describe('onModuleInit', () => {
    it('should connect to the database successfully', async () => {
      await service.onModuleInit();

      expect(service.$connect).toHaveBeenCalled();
      expect(service.$queryRaw).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Prisma connected to PostgreSQL',
      );
    });

    it('should throw error if connection fails', async () => {
      const error = new Error('Connection failed');
      service.$connect = jest.fn().mockRejectedValue(error);

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Prisma connection error:',
        error,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // onModuleDestroy
  // ═══════════════════════════════════════════════════════════════════════════
  describe('onModuleDestroy', () => {
    it('should disconnect from the database', async () => {
      await service.onModuleDestroy();

      expect(service.$disconnect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Prisma disconnected from PostgreSQL',
      );
    });
  });
});
