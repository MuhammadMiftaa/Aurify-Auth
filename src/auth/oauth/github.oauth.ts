import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubOauth extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') ?? '',
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') ?? '',
      callbackURL: `${configService.get<string>('URL')}/auth/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<any> {
    const { emails, username, photos } = profile;

    const user = {
      email: emails[0].value,
      username: username,
      picture: photos[0].value,
      accessToken,
      provider: 'github',
      providerId: profile.id,
    };

    done(null, user);
  }
}