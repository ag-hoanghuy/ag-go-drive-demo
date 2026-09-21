import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { StorageModule } from '../storage/storage.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [AuthModule, GoogleDriveModule, StorageModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
