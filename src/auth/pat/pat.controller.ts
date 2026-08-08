import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PatService } from './pat.service';
import { ValidationPipe } from 'src/validation/validation.pipe';
import {
  CreatePersonalAccessTokenRequest,
  createPersonalAccessTokenValidation,
} from 'src/model/personal-access-token.model';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from 'src/auth/guard/jwt-auth.guard';

@Controller('auth/pat')
export class PatController {
  constructor(private readonly patService: PatService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body(new ValidationPipe(createPersonalAccessTokenValidation))
    body: CreatePersonalAccessTokenRequest,
  ) {
    const res = await this.patService.create(req.user!.id, body);

    return {
      status: true,
      statusCode: 200,
      message: 'Personal access token created successfully, copy it now',
      data: res,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: AuthenticatedRequest) {
    const res = await this.patService.list(req.user!.id);

    return {
      status: true,
      statusCode: 200,
      message: 'Personal access tokens retrieved successfully',
      data: res,
    };
  }

  @Delete('/:id')
  @UseGuards(JwtAuthGuard)
  async revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const res = await this.patService.revoke(req.user!.id, id);

    return {
      status: true,
      statusCode: 200,
      message: 'Personal access token revoked successfully',
      data: res,
    };
  }

  /**
   * Public by design: the personal access token in the Authorization header is
   * itself the credential. Guarding this with JwtAuthGuard would require the
   * very token it issues.
   */
  @Post('/exchange')
  async exchange(@Headers('authorization') authorization: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new HttpException('Missing or invalid Authorization header', 401);
    }

    const res = await this.patService.exchange(
      authorization.slice('Bearer '.length),
    );

    return {
      status: true,
      statusCode: 200,
      message: 'Access token issued successfully',
      data: res,
    };
  }
}
