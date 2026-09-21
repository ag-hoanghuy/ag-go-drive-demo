import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleDriveModule } from './google-drive/google-drive.module';
import { HealthModule } from './health/health.module';
import { ImportModule } from './import/import.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GoogleDriveModule,
    StorageModule,
    ImportModule,
    HealthModule,
  ],
})
export class AppModule {}
