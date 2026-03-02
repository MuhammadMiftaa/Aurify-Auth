import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpRedirectResponse,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterRequest,
  registerRequestValidation,
} from 'src/model/register.model';
import { ValidationPipe } from 'src/validation/validation.pipe';
import {
  VerifyOTPRequest,
  verifyOTPRequestValidation,
} from 'src/model/verify-otp.model';
import {
  CompleteProfileRequest,
  completeProfileRequestValidation,
} from 'src/model/complete-profile.model';
import { LoginRequest, loginRequestValidation } from 'src/model/login.model';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  SetPasswordRequest,
  setPasswordRequestValidation,
} from 'src/model/set-password.model';
import { RequestSetPasswordRequest, requestSetPasswordValidation } from 'src/model/request-set-password.model';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('/register')
  async register(
    @Body(new ValidationPipe(registerRequestValidation)) body: RegisterRequest,
  ) {
    const res = await this.authService.register(body);

    return {
      status: true,
      statusCode: 200,
      message: 'Registration successful, please verify your email',
      data: res,
    };
  }

  @Post('/verify-otp')
  async verifyOTP(
    @Body(new ValidationPipe(verifyOTPRequestValidation))
    body: VerifyOTPRequest,
  ) {
    const res = await this.authService.verifyOTP(body);

    return {
      status: true,
      statusCode: 200,
      message: 'OTP verified successfully',
      data: res,
    };
  }

  @Post('/complete-profile')
  async completeProfile(
    @Body(new ValidationPipe(completeProfileRequestValidation))
    body: CompleteProfileRequest,
    @Query('tempToken') tempToken: string,
  ) {
    const user = await this.authService.completeProfile(body, tempToken);

    return {
      status: true,
      statusCode: 200,
      message: 'Profile completed successfully',
      data: user,
    };
  }

  @Post('/login')
  async login(
    @Body(new ValidationPipe(loginRequestValidation)) user: LoginRequest,
  ) {
    const token = await this.authService.login(user);

    return {
      status: true,
      statusCode: 200,
      message: 'Login successful',
      data: token,
    };
  }

  @Get('/google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // * Guard akan redirect ke Google
  }

  @Get('/google/callback')
  @UseGuards(AuthGuard('google'))
  @Redirect()
  async googleLoginCallback(
    @Req() req: Request,
  ): Promise<HttpRedirectResponse> {
    const res = await this.authService.oauthLoginCallback(req.user);

    return {
      url: `${this.configService.get<string>('REDIRECT_URL')}#aurify_token=${res.token}`,
      statusCode: 302,
    };
  }

  @Get('/github')
  @UseGuards(AuthGuard('github'))
  githubLogin() {
    // * Guard akan redirect ke GitHub
  }

  @Get('/github/callback')
  @UseGuards(AuthGuard('github'))
  @Redirect()
  async githubLoginCallback(
    @Req() req: Request,
  ): Promise<HttpRedirectResponse> {
    const res = await this.authService.oauthLoginCallback(req.user);

    return {
      url: `${this.configService.get<string>('REDIRECT_URL')}#aurify_token=${res.token}`,
      statusCode: 302,
    };
  }

  @Get('/microsoft')
  @UseGuards(AuthGuard('microsoft'))
  microsoftLogin() {
    // * Guard akan redirect ke Microsoft
  }

  @Get('/microsoft/callback')
  @UseGuards(AuthGuard('microsoft'))
  @Redirect()
  async microsoftLoginCallback(
    @Req() req: Request,
  ): Promise<HttpRedirectResponse> {
    const res = await this.authService.oauthLoginCallback(req.user);

    return {
      url: `${this.configService.get<string>('REDIRECT_URL')}#aurify_token=${res.token}`,
      statusCode: 302,
    };
  }

  @Post('/request-set-password')
  async requestSetPassword(@Body(new ValidationPipe(requestSetPasswordValidation)) body: RequestSetPasswordRequest) {
    const res = await this.authService.setPasswordOTP(body.email);

    return {
      status: true,
      statusCode: 200,
      message: 'OTP sent successfully',
      data: res,
    };
  }

  @Post('/set-password')
  async setPassword(
    @Body(new ValidationPipe(setPasswordRequestValidation))
    body: SetPasswordRequest,
    @Query('tempToken') tempToken: string,
  ) {
    const token = await this.authService.setPassword(body, tempToken);

    return {
      status: true,
      statusCode: 200,
      message: 'Password set successfully',
      data: token,
    };
  }

  @Post('/logout')
  logout() {
    return this.authService.logout();
  }
}
