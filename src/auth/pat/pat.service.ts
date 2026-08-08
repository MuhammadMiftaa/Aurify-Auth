import { HttpException, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from 'src/prisma/prisma/prisma.service';
import {
  CreatePersonalAccessTokenRequest,
  CreatePersonalAccessTokenResponse,
  ExchangePersonalAccessTokenResponse,
  PersonalAccessTokenResponse,
} from 'src/model/personal-access-token.model';
import {
  PAT_ACCESS_TOKEN_TTL_SECONDS,
  PAT_PREFIX,
} from 'src/utils/const.utils';
import {
  generatePersonalAccessToken,
  hashPersonalAccessToken,
} from 'src/utils/generate.utils';

const TOKEN_LIST_SELECT = {
  id: true,
  name: true,
  scopes: true,
  lastUsedAt: true,
  expiresAt: true,
  createdAt: true,
} as const;

//~ S1192: reused across the reject paths below.
const INVALID_TOKEN_MESSAGE = 'Invalid, expired, or revoked access token';

@Injectable()
export class PatService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async create(
    userId: string,
    body: CreatePersonalAccessTokenRequest,
  ): Promise<CreatePersonalAccessTokenResponse> {
    const token = generatePersonalAccessToken();

    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const created = await this.prisma.personalAccessToken.create({
      select: TOKEN_LIST_SELECT,
      data: {
        userId,
        name: body.name,
        tokenHash: hashPersonalAccessToken(token),
        scopes: body.scopes,
        expiresAt,
      },
    });

    this.logger.info(
      `Personal access token created: ${created.id} for user ${userId}`,
    );

    //~ The only moment the plaintext token exists outside the caller.
    return { ...created, token };
  }

  async list(userId: string): Promise<PersonalAccessTokenResponse[]> {
    return this.prisma.personalAccessToken.findMany({
      select: TOKEN_LIST_SELECT,
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(userId: string, id: string): Promise<{ id: string }> {
    //~ Scoped by userId so one user cannot revoke another's token by guessing
    //~ an id.
    const result = await this.prisma.personalAccessToken.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      throw new HttpException('Personal access token not found', 404);
    }

    this.logger.info(`Personal access token revoked: ${id} by user ${userId}`);

    return { id };
  }

  /**
   * Trades a personal access token for a short-lived JWT.
   *
   * The JWT carries exactly the claims the BFF already expects — including
   * `userAuthProvider`, which it dereferences without checking — so no
   * downstream service needs to learn about personal access tokens.
   */
  async exchange(
    rawToken: string,
  ): Promise<ExchangePersonalAccessTokenResponse> {
    if (!rawToken?.startsWith(PAT_PREFIX)) {
      throw new HttpException(INVALID_TOKEN_MESSAGE, 401);
    }

    const record = await this.prisma.personalAccessToken.findUnique({
      select: {
        id: true,
        scopes: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            deletedAt: true,
            userAuthProvider: {
              select: { provider: true, providerUserId: true },
            },
          },
        },
      },
      where: { tokenHash: hashPersonalAccessToken(rawToken) },
    });

    if (!record || record.revokedAt || record.user.deletedAt) {
      throw new HttpException(INVALID_TOKEN_MESSAGE, 401);
    }

    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      throw new HttpException(INVALID_TOKEN_MESSAGE, 401);
    }

    await this.prisma.personalAccessToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    const accessToken = this.jwtService.sign(
      {
        id: record.user.id,
        email: record.user.email,
        //~ Falls back to a local provider stub: the BFF asserts on this object
        //~ unconditionally and would return 500 if it were absent.
        userAuthProvider: record.user.userAuthProvider[0] ?? {
          provider: 'local',
          providerUserId: record.user.id,
        },
        scope: record.scopes.join(' '),
      },
      { expiresIn: PAT_ACCESS_TOKEN_TTL_SECONDS },
    );

    return {
      accessToken,
      expiresIn: PAT_ACCESS_TOKEN_TTL_SECONDS,
      scopes: record.scopes,
    };
  }
}
