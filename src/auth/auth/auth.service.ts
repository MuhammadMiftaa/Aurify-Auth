import { HttpException, Inject, Injectable } from '@nestjs/common';
import { CompleteProfileRequest } from 'src/model/complete-profile.model';
import { LoginRequest } from 'src/model/login.model';
import { RegisterRequest } from 'src/model/register.model';
import { VerifyOTPRequest } from 'src/model/verify-otp.model';
import { PrismaService } from 'src/prisma/prisma/prisma.service';
import { OTP_EXPIRATION, OTP_PURPOSE, OTP_STATUS } from 'src/utils/const.utils';
import {
  generateHashPassword,
  generateOTP,
  generateTempToken,
} from 'src/utils/generate.utils';
import bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from 'src/email/email/email.service';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { SetPasswordRequest } from 'src/model/set-password.model';
import { ProfileGrpcService } from 'src/grpc/profile/profile-grpc.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private profileGrpcService: ProfileGrpcService,
  ) {}

  async register(body: RegisterRequest): Promise<{ email: string }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser && existingUser.password !== '') {
      throw new HttpException('User already exists', 400);
    } else if (existingUser && existingUser.password === '') {
      throw new HttpException(
        'Email already registered. Please log in with OAuth or set a password.',
        409,
      );
    }

    const OTP = generateOTP();

    const [_, insertOTP] = await this.prisma.$transaction([
      this.prisma.oTP.updateMany({
        where: { email: body.email },
        data: { status: OTP_STATUS._EXPIRED },
      }),
      this.prisma.oTP.create({
        select: {
          email: true,
          code: true,
          purpose: true,
          status: true,
          expiresAt: true,
        },
        data: {
          email: body.email,
          code: OTP,
          purpose: OTP_PURPOSE._REGISTER,
          status: OTP_STATUS._ACTIVE,
          expiresAt: new Date(Date.now() + OTP_EXPIRATION),
        },
      }),
    ]);

    try {
      await this.emailService.sendOTP(body.email, OTP);
    } catch (error) {
      this.logger.error('Error sending OTP email:', error);
    }

    return { email: insertOTP.email };
  }

  async verifyOTP(body: VerifyOTPRequest): Promise<{ tempToken: string }> {
    const OTP = await this.prisma.oTP.findFirst({
      select: {
        id: true,
        email: true,
        code: true,
        status: true,
        expiresAt: true,
      },
      where: { email: body.email },
      orderBy: { createdAt: 'desc' },
    });

    if (!OTP) {
      throw new HttpException('Invalid OTP', 400);
    }

    if (OTP.code !== body.otp) {
      throw new HttpException('Invalid OTP', 400);
    }

    if (OTP.status !== OTP_STATUS._ACTIVE) {
      throw new HttpException('OTP is not active', 400);
    }

    if (OTP.expiresAt < new Date()) {
      throw new HttpException('OTP has expired', 400);
    }

    const tempToken = generateTempToken();

    await this.prisma.oTP.update({
      where: { id: OTP.id },
      data: { status: OTP_STATUS._VERIFIED, tempToken: tempToken },
    });

    return { tempToken };
  }

  // Returns JWT token directly (same as login) after creating the user and calling gRPC CreateProfile
  async completeProfile(
    body: CompleteProfileRequest,
    tempToken: string,
  ): Promise<{ token: string }> {
    if (!tempToken) {
      throw new HttpException('Invalid temp token', 400);
    }

    const OTP = await this.prisma.oTP.findFirst({
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
      },
      where: { tempToken: tempToken },
    });

    if (!OTP) {
      throw new HttpException('Invalid token', 400);
    }

    if (OTP.status !== OTP_STATUS._VERIFIED) {
      throw new HttpException('Invalid token', 400);
    }

    if (OTP?.expiresAt < new Date()) {
      await this.prisma.oTP.update({
        where: { id: OTP.id },
        data: { status: OTP_STATUS._EXPIRED },
      });
      throw new HttpException('Expired token', 400);
    }

    const userExists = await this.prisma.user.findUnique({
      where: { email: OTP.email },
    });

    if (userExists) {
      throw new HttpException('User already exists', 400);
    }

    const hashedPassword = generateHashPassword(body.password);

    const userCreated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: OTP.email,
          password: hashedPassword,
        },
      });

      await tx.userAuthProvider.create({
        data: {
          provider: 'local',
          providerUserId: user.id,
          userId: user.id,
        },
      });

      await tx.oTP.update({
        where: { id: OTP.id },
        data: { status: OTP_STATUS._COMPLETED },
      });

      return user;
    });

    // Call gRPC CreateProfile — fire-and-forget style: log errors but don't fail registration
    try {
      await this.profileGrpcService.createProfile({
        user_id: userCreated.id,
        fullname: body.name,
      });
    } catch (error) {
      this.logger.error('Error calling gRPC CreateProfile:', error);
    }

    const token = this.jwtService.sign({
      id: userCreated.id,
      email: userCreated.email,
      userAuthProvider: { provider: 'local', providerUserId: userCreated.id },
    });

    return { token };
  }

  async login(body: LoginRequest): Promise<{ token: string }> {
    const user = await this.prisma.user.findUnique({
      select: {
        id: true,
        email: true,
        password: true,
        userAuthProvider: {
          select: { provider: true, providerUserId: true },
          where: { provider: 'local' },
        },
        createdAt: true,
        deletedAt: true,
      },
      where: { email: body.email, deletedAt: null },
    });

    if (!user) {
      throw new HttpException('User not found', 404);
    }

    if (user.password === '') {
      throw new HttpException(
        'This account was created using OAuth. Please log in with OAuth or set a password.',
        409,
      );
    }

    const isValidPassword = bcrypt.compareSync(body.password, user.password);

    if (!isValidPassword) {
      throw new HttpException('Invalid password', 400);
    }

    const token = this.jwtService.sign({
      id: user.id,
      email: user.email,
      userAuthProvider: user.userAuthProvider[0],
    });

    return { token };
  }

  async oauthLoginCallback(oauthUser: any): Promise<{ token: string }> {
    // $ Check if user (email) has ever created
    let user = await this.prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        userAuthProvider: {
          select: { provider: true, providerUserId: true },
        },
      },
      where: { email: oauthUser.email, deletedAt: null },
    });

    let userAuthProvider: {
      provider: string;
      providerUserId: string;
    } | null = null;

    if (user) {
      // $ If email has ever created, link existing email with OAuth provider
      // $ Check if user has already linked their account with the OAuth provider
      userAuthProvider = await this.prisma.userAuthProvider.findFirst({
        where: { userId: user.id, provider: oauthUser.provider },
        select: { provider: true, providerUserId: true },
      });

      if (!userAuthProvider) {
        userAuthProvider = await this.prisma.userAuthProvider.create({
          data: {
            userId: user.id,
            provider: oauthUser.provider,
            providerUserId: oauthUser.providerId,
          },
          select: { provider: true, providerUserId: true },
        });
      }
    } else {
      user = await this.prisma.user.create({
        select: {
          id: true,
          email: true,
          userAuthProvider: {
            select: { provider: true, providerUserId: true },
          },
        },
        data: {
          email: oauthUser.email,
          password: '',
          userAuthProvider: {
            create: {
              provider: oauthUser.provider,
              providerUserId: oauthUser.providerId,
            },
          },
        },
      });

      // Call gRPC CreateProfile for new OAuth users — fire-and-forget
      try {
        await this.profileGrpcService.createProfile({
          user_id: user.id,
          fullname: oauthUser.firstName || oauthUser.username || oauthUser.name,
        });
      } catch (error) {
        this.logger.error('Error calling gRPC CreateProfile (OAuth):', error);
      }
    }

    const token = this.jwtService.sign({
      id: user.id,
      email: user.email,
      userAuthProvider:
        userAuthProvider || // $ If user has linked their account with the OAuth provider
        user.userAuthProvider.find(
          // $ If user recently create account with the OAuth provider
          (auth) => auth.provider === oauthUser.provider,
        ),
    });

    return { token };
  }

  async setPasswordOTP(email: string): Promise<{ email: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new HttpException('User not found', 404);
    }

    const purpose =
      user.password === '' ? OTP_PURPOSE._SET_PASSWORD : OTP_PURPOSE._FORGOT_PASSWORD;

    const OTP = generateOTP();

    const [_, insertOTP] = await this.prisma.$transaction([
      this.prisma.oTP.updateMany({
        where: { email: email },
        data: { status: OTP_STATUS._EXPIRED },
      }),
      this.prisma.oTP.create({
        select: {
          email: true,
          code: true,
          purpose: true,
          status: true,
          expiresAt: true,
        },
        data: {
          email: email,
          code: OTP,
          purpose,
          status: OTP_STATUS._ACTIVE,
          expiresAt: new Date(Date.now() + OTP_EXPIRATION),
        },
      }),
    ]);

    try {
      await this.emailService.sendOTP(email, OTP);
    } catch (error) {
      this.logger.error('Error sending OTP email:', error);
    }

    return { email: insertOTP.email };
  }

  async setPassword(
    body: SetPasswordRequest,
    tempToken: string,
  ): Promise<{ token: string }> {
    if (!tempToken) {
      throw new HttpException('Invalid temp token', 400);
    }

    const OTP = await this.prisma.oTP.findFirst({
      select: { id: true, email: true, status: true, expiresAt: true },
      where: { tempToken: tempToken },
    });

    if (!OTP) {
      throw new HttpException('Invalid token', 400);
    }

    if (OTP.status !== OTP_STATUS._VERIFIED) {
      throw new HttpException('Invalid token', 400);
    }

    if (OTP?.expiresAt < new Date()) {
      await this.prisma.oTP.update({
        where: { id: OTP.id },
        data: { status: OTP_STATUS._EXPIRED },
      });
      throw new HttpException('Expired token', 400);
    }

    const hashedPassword = generateHashPassword(body.password);

    const { userUpdated, userAuthProvider } = await this.prisma.$transaction(
      async (tx) => {
        const userUpdated = await tx.user.update({
          where: { email: OTP.email },
          data: { password: hashedPassword },
        });

        const userAuthProvider = await tx.userAuthProvider.upsert({
          where: {
            userId: userUpdated.id,
            provider_providerUserId: {
              provider: 'local',
              providerUserId: userUpdated.id,
            },
          },
          create: {
            provider: 'local',
            providerUserId: userUpdated.id,
            userId: userUpdated.id,
          },
          update: {},
          select: {
            id: true,
            provider: true,
            providerUserId: true,
            userId: true,
          },
        });

        await tx.oTP.update({
          where: { id: OTP.id },
          data: { status: OTP_STATUS._COMPLETED },
        });

        return { userUpdated, userAuthProvider };
      },
    );

    const token = this.jwtService.sign({
      id: userUpdated.id,
      email: userUpdated.email,
      userAuthProvider: {
        provider: userAuthProvider?.provider,
        providerUserId: userAuthProvider?.providerUserId,
      },
    });

    return { token };
  }

  async logout() {
    return { message: 'User logged out successfully' };
  }
}
