import { Controller, Get } from '@nestjs/common';
import { StorageService } from './storage.service';
import type { StorageStatus } from './storage.types';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('status')
  status(): StorageStatus {
    return this.storageService.getStatus();
  }
}
