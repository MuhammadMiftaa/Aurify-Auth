import { ValidationFilter } from './validation.filter';
import { ZodError } from 'zod';
import { ArgumentsHost } from '@nestjs/common';

describe('ValidationFilter', () => {
  let filter: ValidationFilter;

  beforeEach(() => {
    filter = new ValidationFilter();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // catch - ZodError handling
  // ═══════════════════════════════════════════════════════════════════════════
  describe('catch', () => {
    it('should return 400 with validation issues', () => {
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      const mockResponse = { status: mockStatus };

      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['email'],
          message: 'Required',
        },
      ]);

      filter.catch(zodError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        status: false,
        statusCode: 400,
        message: 'Validation failed',
        data: zodError.issues,
      });
    });

    it('should handle multiple validation issues', () => {
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      const mockResponse = { status: mockStatus };

      const mockHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
        }),
      } as unknown as ArgumentsHost;

      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['email'],
          message: 'Required',
        },
        {
          origin: 'body',
          code: 'too_small',
          minimum: 6,
          inclusive: true,
          exact: false,
          path: ['password'],
          message: 'String must contain at least 6 character(s)',
        },
      ]);

      filter.catch(zodError, mockHost);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ path: ['email'] }),
            expect.objectContaining({ path: ['password'] }),
          ]),
        }),
      );
    });
  });
});
