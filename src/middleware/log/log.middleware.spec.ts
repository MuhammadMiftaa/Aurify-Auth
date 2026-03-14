import { LogMiddleware } from './log.middleware';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('LogMiddleware', () => {
  let middleware: LogMiddleware;

  beforeEach(() => {
    middleware = new LogMiddleware(mockLogger as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // use
  // ═══════════════════════════════════════════════════════════════════════════
  describe('use', () => {
    it('should log incoming request and call next()', () => {
      const mockReq = {
        method: 'POST',
        originalUrl: '/auth/login',
        ip: '127.0.0.1',
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      middleware.use(mockReq, mockRes, mockNext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming Request: POST /auth/login from 127.0.0.1',
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle GET request', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/auth/google',
        ip: '192.168.1.1',
      } as any;
      const mockRes = {} as any;
      const mockNext = jest.fn();

      middleware.use(mockReq, mockRes, mockNext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming Request: GET /auth/google from 192.168.1.1',
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
