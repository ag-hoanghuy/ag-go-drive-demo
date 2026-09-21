import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { StorageService } from './storage.service';
import type { StorageStatus } from './storage.types';

@Controller('storage')
@UseGuards(AuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('status')
  status(): StorageStatus {
    return this.storageService.getStatus();
  }
}
