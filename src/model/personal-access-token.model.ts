import z from 'zod';
import { PAT_SCOPES, type PatScope } from 'src/utils/const.utils';

export class CreatePersonalAccessTokenRequest {
  name: string;
  scopes: PatScope[];
  expiresInDays?: number;
}

export const createPersonalAccessTokenValidation = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(PAT_SCOPES)).min(1),
  //~ Omitted means the token does not expire on its own; it can still be
  //~ revoked at any time.
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export class PersonalAccessTokenResponse {
  id: string;
  name: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export class CreatePersonalAccessTokenResponse extends PersonalAccessTokenResponse {
  /** Returned only once, at creation. Never retrievable afterwards. */
  token: string;
}

export class ExchangePersonalAccessTokenResponse {
  accessToken: string;
  expiresIn: number;
  scopes: string[];
}
