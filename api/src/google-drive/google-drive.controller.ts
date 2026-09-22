import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Redirect,
} from '@nestjs/common';
import { DemoSessionId } from '../demo-session/demo-session-id.decorator';
import { GoogleDriveOAuthService } from './google-drive-oauth.service';
import { GoogleDriveService } from './google-drive.service';
import type {
  GoogleAuthorizationResponse,
  GoogleDriveConnectionStatus,
  GoogleDriveItem,
  GooglePickerTokenResponse,
} from './google-drive.types';

interface OAuthRedirectResponse {
  url: string;
  statusCode: number;
}

@Controller('google-drive')
export class GoogleDriveController {
  constructor(
    private readonly googleDriveOAuth: GoogleDriveOAuthService,
    private readonly googleDriveService: GoogleDriveService,
  ) {}

  @Get('connect')
  connect(
    @DemoSessionId() demoSessionId: string,
  ): GoogleAuthorizationResponse {
    return this.googleDriveOAuth.createAuthorizationUrl(demoSessionId);
  }

  @Get('callback')
  @Redirect()
  async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ): Promise<OAuthRedirectResponse> {
    try {
      if (!state) {
        throw new Error('Missing state');
      }

      if (error || !code) {
        this.googleDriveOAuth.cancelAuthorization(state);
        return this.redirectToFrontend('error');
      }

      await this.googleDriveOAuth.completeAuthorization(code, state);
      return this.redirectToFrontend('connected');
    } catch {
      return this.redirectToFrontend('error');
    }
  }

  @Get('status')
  status(
    @DemoSessionId() demoSessionId: string,
  ): GoogleDriveConnectionStatus {
    return this.googleDriveOAuth.getStatus(demoSessionId);
  }

  @Get('picker-token')
  @Header('Cache-Control', 'no-store')
  pickerToken(
    @DemoSessionId() demoSessionId: string,
  ): Promise<GooglePickerTokenResponse> {
    return this.googleDriveOAuth.getPickerToken(demoSessionId);
  }

  @Delete('disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @DemoSessionId() demoSessionId: string,
  ): Promise<void> {
    await this.googleDriveOAuth.disconnect(demoSessionId);
  }

  @Get('items')
  async listItems(
    @DemoSessionId() demoSessionId: string,
    @Query('parentId') parentId?: unknown,
  ): Promise<GoogleDriveItem[]> {
    if (parentId !== undefined && typeof parentId !== 'string') {
      throw new BadRequestException('parentId không hợp lệ');
    }

    return this.googleDriveService.listItems(demoSessionId, parentId);
  }

  @Get('items/:id')
  async getItem(
    @DemoSessionId() demoSessionId: string,
    @Param('id') itemId: string,
  ): Promise<GoogleDriveItem> {
    return this.googleDriveService.getItem(demoSessionId, itemId);
  }

  private redirectToFrontend(
    result: 'connected' | 'error',
  ): OAuthRedirectResponse {
    return {
      url: this.googleDriveOAuth.createFrontendRedirect(result),
      statusCode: HttpStatus.FOUND,
    };
  }
}
