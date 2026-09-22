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
  itemIds?: unknown;
}

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('google-drive')
  async importGoogleDrive(
    @DemoSessionId() demoSessionId: string,
    @Body() body: GoogleDriveImportBody | undefined,
  ): Promise<GoogleDriveImportResult> {
    if (!body || !Array.isArray(body.itemIds) || body.itemIds.length === 0) {
      throw new BadRequestException('itemIds phải là array không rỗng');
    }

    if (
      body.itemIds.some(
        (itemId) => typeof itemId !== 'string' || !itemId.trim(),
      )
    ) {
      throw new BadRequestException('itemIds chứa ID không hợp lệ');
    }

    const itemIds = [
      ...new Set(body.itemIds.map((itemId) => (itemId as string).trim())),
    ];

    return this.importService.importGoogleDriveItems(demoSessionId, itemIds);
  }
}
