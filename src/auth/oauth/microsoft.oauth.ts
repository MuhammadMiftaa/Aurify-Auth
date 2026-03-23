import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MicrosoftOauth extends PassportStrategy(Strategy, 'microsoft') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('MICROSOFT_CLIENT_ID') ?? '',
      clientSecret: configService.get<string>('MICROSOFT_CLIENT_SECRET') ?? '',
      callbackURL: `${configService.get<string>('URL')}/auth/microsoft/callback`,
      scope: ['user.read'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const { displayName, emails } = profile;

    const user = {
      email: emails[0].value,
      name: displayName,
      accessToken,
      provider: 'microsoft',
      providerId: profile.id,
    };

    done(null, user);
  }
}