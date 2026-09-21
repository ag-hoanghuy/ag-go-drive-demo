import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Param,
  Query,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { GoogleDriveOAuthService } from './google-drive-oauth.service';
import { GoogleDriveService } from './google-drive.service';
import type {
  GoogleAuthorizationResponse,
  GoogleDriveConnectionStatus,
  GoogleDriveItem,
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
  @UseGuards(AuthGuard)
  connect(
    @CurrentUser() user: AuthenticatedUser,
  ): GoogleAuthorizationResponse {
    return this.googleDriveOAuth.createAuthorizationUrl(user.sub);
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
  @UseGuards(AuthGuard)
  status(
    @CurrentUser() user: AuthenticatedUser,
  ): GoogleDriveConnectionStatus {
    return this.googleDriveOAuth.getStatus(user.sub);
  }

  @Delete('disconnect')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.googleDriveOAuth.disconnect(user.sub);
  }

  @Get('items')
  @UseGuards(AuthGuard)
  async listItems(
    @CurrentUser() user: AuthenticatedUser,
    @Query('parentId') parentId?: unknown,
  ): Promise<GoogleDriveItem[]> {
    if (parentId !== undefined && typeof parentId !== 'string') {
      throw new BadRequestException('parentId không hợp lệ');
    }

    return this.googleDriveService.listItems(user.sub, parentId);
  }

  @Get('items/:id')
  @UseGuards(AuthGuard)
  async getItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') itemId: string,
  ): Promise<GoogleDriveItem> {
    return this.googleDriveService.getItem(user.sub, itemId);
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
