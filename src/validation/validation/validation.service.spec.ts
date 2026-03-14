import { Test, TestingModule } from '@nestjs/testing';
import { ValidationService } from './validation.service';
import { z, ZodError } from 'zod';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationService],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validate - valid data
  // ═══════════════════════════════════════════════════════════════════════════
  describe('validate - valid data', () => {
    it('should return parsed data for valid input', () => {
      const schema = z.object({
        email: z.string().email(),
        name: z.string().min(2),
      });

      const result = service.validate(schema, {
        email: 'test@example.com',
        name: 'John',
      });

      expect(result).toEqual({
        email: 'test@example.com',
        name: 'John',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validate - invalid data
  // ═══════════════════════════════════════════════════════════════════════════
  describe('validate - invalid data', () => {
    it('should throw ZodError for invalid data', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      expect(() => service.validate(schema, { email: 'not-valid' })).toThrow(
        ZodError,
      );
    });

    it('should throw ZodError for missing required fields', () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
      });

      expect(() => service.validate(schema, {} as any)).toThrow(ZodError);
    });
  });
});
