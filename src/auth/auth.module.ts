import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GoogleOauth } from './oauth/google.oauth';
import { GithubOauth } from './oauth/github.oauth';
import { MicrosoftOauth } from './oauth/microsoft.oauth';
import { ProfileGrpcModule } from 'src/grpc/profile/profile-grpc.module';
import { PatController } from './pat/pat.controller';
import { PatService } from './pat/pat.service';
import { JwtAuthGuard } from './guard/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '72h' },
      }),
      inject: [ConfigService],
    }),
    ProfileGrpcModule,
  ],
  controllers: [AuthController, PatController],
  providers: [
    AuthService,
    PatService,
    JwtAuthGuard,
    GoogleOauth,
    GithubOauth,
    MicrosoftOauth,
  ],
})
export class AuthModule {}
