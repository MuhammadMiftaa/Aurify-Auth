import { ValidationPipe } from './validation.pipe';
import { z, ZodError } from 'zod';

describe('ValidationPipe', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Basic instantiation
  // ═══════════════════════════════════════════════════════════════════════════
  it('should be defined', () => {
    const schema = z.object({ name: z.string() });
    const pipe = new ValidationPipe(schema);
    expect(pipe).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Valid input
  // ═══════════════════════════════════════════════════════════════════════════
  describe('transform - valid input', () => {
    it('should return parsed value for valid input', () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
      });
      const pipe = new ValidationPipe(schema);

      const result = pipe.transform(
        { email: 'test@example.com', password: 'password123' },
        { type: 'body', metatype: Object, data: '' },
      );

      expect(result).toEqual({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should strip unknown fields from valid input', () => {
      const schema = z.object({ name: z.string() });
      const pipe = new ValidationPipe(schema);

      const result = pipe.transform(
        { name: 'John', extra: 'field' },
        { type: 'body', metatype: Object, data: '' },
      );

      expect(result).toEqual({ name: 'John' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Invalid input
  // ═══════════════════════════════════════════════════════════════════════════
  describe('transform - invalid input', () => {
    it('should throw ZodError for invalid email', () => {
      const schema = z.object({ email: z.string().email() });
      const pipe = new ValidationPipe(schema);

      expect(() =>
        pipe.transform(
          { email: 'not-an-email' },
          { type: 'body', metatype: Object, data: '' },
        ),
      ).toThrow(ZodError);
    });

    it('should throw ZodError for missing required fields', () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
      });
      const pipe = new ValidationPipe(schema);

      expect(() =>
        pipe.transform({}, { type: 'body', metatype: Object, data: '' }),
      ).toThrow(ZodError);
    });

    it('should throw ZodError for password too short', () => {
      const schema = z.object({
        password: z.string().min(6),
      });
      const pipe = new ValidationPipe(schema);

      expect(() =>
        pipe.transform(
          { password: '123' },
          { type: 'body', metatype: Object, data: '' },
        ),
      ).toThrow(ZodError);
    });
  });
});
