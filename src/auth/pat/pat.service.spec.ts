import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { HttpException } from '@nestjs/common';
import { PatService } from './pat.service';
import { PrismaService } from 'src/prisma/prisma/prisma.service';
import * as generateUtils from 'src/utils/generate.utils';
import { PAT_ACCESS_TOKEN_TTL_SECONDS, PAT_PREFIX } from 'src/utils/const.utils';

// ─── Mock Factories ──────────────────────────────────────────────────────────

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockPrismaService = {
  personalAccessToken: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = 'a79a39e5-d70f-41ae-b7e6-36246a99172d';
const TOKEN_ID = '607b782c-ba47-4d5a-8953-4d656741ec34';
const RAW_TOKEN = `${PAT_PREFIX}abcdef123456`;

function tokenRecord(overrides: Record<string, any> = {}) {
  return {
    id: TOKEN_ID,
    scopes: ['wallet:read', 'transaction:write'],
    expiresAt: null,
    revokedAt: null,
    user: {
      id: USER_ID,
      email: 'user@example.com',
      deletedAt: null,
      userAuthProvider: [{ provider: 'local', providerUserId: USER_ID }],
    },
    ...overrides,
  };
}

describe('PatService', () => {
  let service: PatService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('mock-access-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatService,
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<PatService>(PatService);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // create
  // ══════════════════════════════════════════════════════════════════════════

  describe('create', () => {
    it('returns the plaintext token and stores only its hash', async () => {
      jest
        .spyOn(generateUtils, 'generatePersonalAccessToken')
        .mockReturnValue(RAW_TOKEN);
      mockPrismaService.personalAccessToken.create.mockResolvedValue({
        id: TOKEN_ID,
        name: 'hermes',
        scopes: ['wallet:read'],
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
      });

      const result = await service.create(USER_ID, {
        name: 'hermes',
        scopes: ['wallet:read'],
      });

      expect(result.token).toBe(RAW_TOKEN);

      const persisted =
        mockPrismaService.personalAccessToken.create.mock.calls[0][0].data;
      expect(persisted.tokenHash).toBe(
        generateUtils.hashPersonalAccessToken(RAW_TOKEN),
      );
      // The plaintext must never reach the database.
      expect(JSON.stringify(persisted)).not.toContain(RAW_TOKEN);
    });

    it('stores a null expiry when no lifetime is given', async () => {
      mockPrismaService.personalAccessToken.create.mockResolvedValue({});

      await service.create(USER_ID, { name: 'hermes', scopes: ['wallet:read'] });

      expect(
        mockPrismaService.personalAccessToken.create.mock.calls[0][0].data
          .expiresAt,
      ).toBeNull();
    });

    it('converts expiresInDays into an absolute expiry', async () => {
      mockPrismaService.personalAccessToken.create.mockResolvedValue({});

      const before = Date.now();
      await service.create(USER_ID, {
        name: 'hermes',
        scopes: ['wallet:read'],
        expiresInDays: 30,
      });

      const expiresAt: Date =
        mockPrismaService.personalAccessToken.create.mock.calls[0][0].data
          .expiresAt;
      const expected = before + 30 * 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expected - 5000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expected + 5000);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // list
  // ══════════════════════════════════════════════════════════════════════════

  describe('list', () => {
    it('returns only the caller\'s live tokens, without hashes', async () => {
      mockPrismaService.personalAccessToken.findMany.mockResolvedValue([]);

      await service.list(USER_ID);

      const args = mockPrismaService.personalAccessToken.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ userId: USER_ID, revokedAt: null });
      expect(args.select.tokenHash).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // revoke
  // ══════════════════════════════════════════════════════════════════════════

  describe('revoke', () => {
    it('sets revokedAt scoped to the calling user', async () => {
      mockPrismaService.personalAccessToken.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.revoke(USER_ID, TOKEN_ID);

      expect(result).toEqual({ id: TOKEN_ID });
      // userId in the filter is what stops one user revoking another's token.
      expect(
        mockPrismaService.personalAccessToken.updateMany.mock.calls[0][0].where,
      ).toEqual({ id: TOKEN_ID, userId: USER_ID, revokedAt: null });
    });

    it('throws 404 when nothing matched', async () => {
      mockPrismaService.personalAccessToken.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.revoke(USER_ID, TOKEN_ID)).rejects.toThrow(
        HttpException,
      );
    });

    it('throws 404 when revoking a token belonging to someone else', async () => {
      mockPrismaService.personalAccessToken.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.revoke('another-user', TOKEN_ID)).rejects.toThrow(
        'Personal access token not found',
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // exchange
  // ══════════════════════════════════════════════════════════════════════════

  describe('exchange', () => {
    it('issues a short-lived access token carrying the stored scopes', async () => {
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(
        tokenRecord(),
      );
      mockPrismaService.personalAccessToken.update.mockResolvedValue({});

      const result = await service.exchange(RAW_TOKEN);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.expiresIn).toBe(PAT_ACCESS_TOKEN_TTL_SECONDS);
      expect(result.scopes).toEqual(['wallet:read', 'transaction:write']);
    });

    it('includes userAuthProvider, which the BFF dereferences unconditionally', async () => {
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(
        tokenRecord(),
      );
      mockPrismaService.personalAccessToken.update.mockResolvedValue({});

      await service.exchange(RAW_TOKEN);

      const claims = mockJwtService.sign.mock.calls[0][0];
      expect(claims).toMatchObject({
        id: USER_ID,
        email: 'user@example.com',
        userAuthProvider: { provider: 'local', providerUserId: USER_ID },
        scope: 'wallet:read transaction:write',
      });
    });

    it('falls back to a local provider when the user has none linked', async () => {
      // Without this the BFF's unchecked type assertion would panic into a 500.
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(
        tokenRecord({
          user: {
            id: USER_ID,
            email: 'user@example.com',
            deletedAt: null,
            userAuthProvider: [],
          },
        }),
      );
      mockPrismaService.personalAccessToken.update.mockResolvedValue({});

      await service.exchange(RAW_TOKEN);

      expect(mockJwtService.sign.mock.calls[0][0].userAuthProvider).toEqual({
        provider: 'local',
        providerUserId: USER_ID,
      });
    });

    it('signs with the short TTL rather than the 72h default', async () => {
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(
        tokenRecord(),
      );
      mockPrismaService.personalAccessToken.update.mockResolvedValue({});

      await service.exchange(RAW_TOKEN);

      expect(mockJwtService.sign.mock.calls[0][1]).toEqual({
        expiresIn: PAT_ACCESS_TOKEN_TTL_SECONDS,
      });
    });

    it('looks the token up by hash, never by plaintext', async () => {
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(
        tokenRecord(),
      );
      mockPrismaService.personalAccessToken.update.mockResolvedValue({});

      await service.exchange(RAW_TOKEN);

      expect(
        mockPrismaService.personalAccessToken.findUnique.mock.calls[0][0].where,
      ).toEqual({ tokenHash: generateUtils.hashPersonalAccessToken(RAW_TOKEN) });
    });

    it('records lastUsedAt', async () => {
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(
        tokenRecord(),
      );
      mockPrismaService.personalAccessToken.update.mockResolvedValue({});

      await service.exchange(RAW_TOKEN);

      expect(
        mockPrismaService.personalAccessToken.update.mock.calls[0][0].data
          .lastUsedAt,
      ).toBeInstanceOf(Date);
    });

    it('rejects a token without the expected prefix before hitting the database', async () => {
      await expect(service.exchange('not-a-pat')).rejects.toThrow(HttpException);
      expect(
        mockPrismaService.personalAccessToken.findUnique,
      ).not.toHaveBeenCalled();
    });

    it('rejects an empty token', async () => {
      await expect(service.exchange('')).rejects.toThrow(HttpException);
    });

    it('rejects an unknown token', async () => {
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(null);

      await expect(service.exchange(RAW_TOKEN)).rejects.toThrow(
        'Invalid, expired, or revoked access token',
      );
    });

    it('rejects a revoked token', async () => {
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(
        tokenRecord({ revokedAt: new Date() }),
      );

      await expect(service.exchange(RAW_TOKEN)).rejects.toThrow(HttpException);
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(
        tokenRecord({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.exchange(RAW_TOKEN)).rejects.toThrow(HttpException);
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('accepts a token whose expiry is still in the future', async () => {
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(
        tokenRecord({ expiresAt: new Date(Date.now() + 60_000) }),
      );
      mockPrismaService.personalAccessToken.update.mockResolvedValue({});

      await expect(service.exchange(RAW_TOKEN)).resolves.toMatchObject({
        accessToken: 'mock-access-token',
      });
    });

    it('rejects a token whose user has been soft deleted', async () => {
      mockPrismaService.personalAccessToken.findUnique.mockResolvedValue(
        tokenRecord({
          user: {
            id: USER_ID,
            email: 'user@example.com',
            deletedAt: new Date(),
            userAuthProvider: [],
          },
        }),
      );

      await expect(service.exchange(RAW_TOKEN)).rejects.toThrow(HttpException);
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });
});
