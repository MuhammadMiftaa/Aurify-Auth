import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/** Claims carried by every Aurify access token. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Verifies the bearer token issued by login/OAuth and attaches the caller to the
 * request. Applied only to the token-management endpoints: the rest of this
 * service is either public (login, OTP) or guarded by passport.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new HttpException('Missing or invalid Authorization header', 401);
    }

    let payload: unknown;
    try {
      payload = this.jwtService.verify(header.slice('Bearer '.length));
    } catch {
      throw new HttpException('Invalid or expired token', 401);
    }

    const claims = payload as Partial<AuthenticatedUser> | null;
    if (typeof claims?.id !== 'string' || typeof claims?.email !== 'string') {
      throw new HttpException('Invalid or expired token', 401);
    }

    request.user = { id: claims.id, email: claims.email };
    return true;
  }
}
