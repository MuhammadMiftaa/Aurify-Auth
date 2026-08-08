import { ExecutionContext, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard';

const mockJwtService = { verify: jest.fn() } as unknown as JwtService;

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(mockJwtService);
  });

  it('attaches the caller when the token is valid', () => {
    (mockJwtService.verify as jest.Mock).mockReturnValue({
      id: 'user-1',
      email: 'user@example.com',
    });
    const request = { headers: { authorization: 'Bearer good-token' } } as any;

    expect(guard.canActivate(contextFor(request))).toBe(true);
    expect(request.user).toEqual({ id: 'user-1', email: 'user@example.com' });
    expect(mockJwtService.verify).toHaveBeenCalledWith('good-token');
  });

  it('rejects a request with no Authorization header', () => {
    expect(() => guard.canActivate(contextFor({ headers: {} } as any))).toThrow(
      HttpException,
    );
  });

  it('rejects a non-bearer Authorization header', () => {
    const request = { headers: { authorization: 'Basic abc' } } as any;

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      'Missing or invalid Authorization header',
    );
  });

  it('rejects a token that fails verification', () => {
    (mockJwtService.verify as jest.Mock).mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const request = { headers: { authorization: 'Bearer bad' } } as any;

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      'Invalid or expired token',
    );
  });

  it('rejects a validly signed token that lacks the expected claims', () => {
    // A token signed with the right secret but shaped differently must not be
    // trusted; reading claims blindly is how the BFF ends up throwing a 500.
    (mockJwtService.verify as jest.Mock).mockReturnValue({ sub: 'user-1' });
    const request = { headers: { authorization: 'Bearer odd' } } as any;

    expect(() => guard.canActivate(contextFor(request))).toThrow(
      'Invalid or expired token',
    );
  });

  it('rejects a token whose claims are not an object', () => {
    (mockJwtService.verify as jest.Mock).mockReturnValue('a-string');
    const request = { headers: { authorization: 'Bearer odd' } } as any;

    expect(() => guard.canActivate(contextFor(request))).toThrow(HttpException);
  });
});
