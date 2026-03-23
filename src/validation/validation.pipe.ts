import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

@Injectable()
export class ValidationPipe implements PipeTransform {
  constructor(private readonly zodType: ZodType) {}

  transform(value: any, metadata: ArgumentMetadata) {
    return this.zodType.parse(value);
  }
}