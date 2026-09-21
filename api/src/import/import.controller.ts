import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ImportService } from './import.service';
import type { GoogleDriveImportResult } from './import.types';

interface GoogleDriveImportBody {
  itemId?: unknown;
}

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('google-drive')
  @UseGuards(AuthGuard)
  async importGoogleDrive(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GoogleDriveImportBody | undefined,
  ): Promise<GoogleDriveImportResult> {
    if (!body || typeof body.itemId !== 'string' || !body.itemId.trim()) {
      throw new BadRequestException('itemId không hợp lệ');
    }

    return this.importService.importGoogleDriveItem(
      user.sub,
      body.itemId.trim(),
    );
  }
}
