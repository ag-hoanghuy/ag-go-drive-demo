import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import { DemoSessionId } from '../demo-session/demo-session-id.decorator';
import { ImportService } from './import.service';
import type { GoogleDriveImportResult } from './import.types';

interface GoogleDriveImportBody {
  itemId?: unknown;
}

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('google-drive')
  async importGoogleDrive(
    @DemoSessionId() demoSessionId: string,
    @Body() body: GoogleDriveImportBody | undefined,
  ): Promise<GoogleDriveImportResult> {
    if (!body || typeof body.itemId !== 'string' || !body.itemId.trim()) {
      throw new BadRequestException('itemId không hợp lệ');
    }

    return this.importService.importGoogleDriveItem(
      demoSessionId,
      body.itemId.trim(),
    );
  }
}
