import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthClientFactory } from './google-oauth-client.factory';
import { GoogleDriveTokenStore } from './google-drive-token.store';
import type {
  GoogleAuthorizationResponse,
  GoogleCallbackResult,
  GoogleDriveConnectionStatus,
} from './google-drive.types';
import { GoogleOAuthStateStore } from './google-oauth-state.store';

const DRIVE_READONLY_SCOPE =
  'https://www.googleapis.com/auth/drive.readonly';

@Injectable()
export class GoogleDriveOAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthClientFactory: GoogleOAuthClientFactory,
    private readonly stateStore: GoogleOAuthStateStore,
    private readonly tokenStore: GoogleDriveTokenStore,
  ) {}

  createAuthorizationUrl(subject: string): GoogleAuthorizationResponse {
    const oauthClient = this.oauthClientFactory.create();
    const state = this.stateStore.create(subject);
    const authorizationUrl = oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [DRIVE_READONLY_SCOPE],
      state,
    });

    return { authorizationUrl };
  }

  async completeAuthorization(code: string, state: string): Promise<void> {
    const subject = this.consumeState(state);
    const oauthClient = this.oauthClientFactory.create();
    const { tokens } = await oauthClient.getToken(code);
    const existingCredentials = this.tokenStore.get(subject);

    if (!tokens.access_token && !tokens.refresh_token) {
      throw new BadRequestException('Google không trả về OAuth token');
    }

    this.tokenStore.save(subject, {
      accessToken: tokens.access_token ?? existingCredentials?.accessToken ?? null,
      refreshToken:
        tokens.refresh_token ?? existingCredentials?.refreshToken ?? null,
      expiryDate: tokens.expiry_date ?? null,
    });
  }

  cancelAuthorization(state: string): void {
    this.consumeState(state);
  }

  getStatus(subject: string): GoogleDriveConnectionStatus {
    return { connected: this.tokenStore.has(subject) };
  }

  async disconnect(subject: string): Promise<void> {
    const credentials = this.tokenStore.get(subject);

    if (!credentials) {
      return;
    }

    const token = credentials.refreshToken ?? credentials.accessToken;

    if (token) {
      try {
        await this.oauthClientFactory.create().revokeToken(token);
      } catch {
        // Vẫn xóa token cục bộ nếu Google không thể revoke.
      }
    }

    this.tokenStore.delete(subject);
  }

  createFrontendRedirect(result: GoogleCallbackResult): string {
    const frontendOrigin =
      this.configService.get<string>('FRONTEND_ORIGIN')?.trim() ||
      'http://localhost:5173';
    const redirectUrl = new URL(frontendOrigin);
    redirectUrl.searchParams.set('googleDrive', result);
    return redirectUrl.toString();
  }

  private consumeState(state: string): string {
    const subject = this.stateStore.consume(state);

    if (!subject) {
      throw new BadRequestException('Google OAuth state không hợp lệ hoặc đã hết hạn');
    }

    return subject;
  }

}
