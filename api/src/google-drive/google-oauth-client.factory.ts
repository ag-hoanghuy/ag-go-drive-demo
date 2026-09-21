import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { GoogleDriveTokenStore } from './google-drive-token.store';

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

@Injectable()
export class GoogleOAuthClientFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly tokenStore: GoogleDriveTokenStore,
  ) {}

  create(): OAuth2Client {
    return new google.auth.OAuth2(
      this.getRequiredConfig('GOOGLE_CLIENT_ID'),
      this.getRequiredConfig('GOOGLE_CLIENT_SECRET'),
      this.getRequiredConfig('GOOGLE_REDIRECT_URI'),
    );
  }

  createForSession(demoSessionId: string): OAuth2Client {
    const credentials = this.tokenStore.get(demoSessionId);

    if (!credentials) {
      throw new BadRequestException('Google Drive chưa được kết nối');
    }

    const oauthClient = this.create();
    oauthClient.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate,
    });
    oauthClient.on('tokens', (tokens) => {
      this.tokenStore.update(demoSessionId, {
        ...(tokens.access_token
          ? { accessToken: tokens.access_token }
          : {}),
        ...(tokens.refresh_token
          ? { refreshToken: tokens.refresh_token }
          : {}),
        ...(tokens.expiry_date ? { expiryDate: tokens.expiry_date } : {}),
      });
    });

    return oauthClient;
  }

  private getRequiredConfig(name: string): string {
    const value = this.configService.get<string>(name)?.trim();

    if (!value) {
      throw new ServiceUnavailableException(
        'Google OAuth chưa được cấu hình đầy đủ',
      );
    }

    return value;
  }
}
