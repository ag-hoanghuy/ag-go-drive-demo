import { Module } from '@nestjs/common';
import { GoogleDriveController } from './google-drive.controller';
import { GoogleDriveOAuthService } from './google-drive-oauth.service';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveTokenStore } from './google-drive-token.store';
import { GoogleOAuthClientFactory } from './google-oauth-client.factory';
import { GoogleOAuthStateStore } from './google-oauth-state.store';

@Module({
  controllers: [GoogleDriveController],
  providers: [
    GoogleDriveOAuthService,
    GoogleDriveService,
    GoogleDriveTokenStore,
    GoogleOAuthClientFactory,
    GoogleOAuthStateStore,
  ],
  exports: [GoogleDriveService],
})
export class GoogleDriveModule {}
