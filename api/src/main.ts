import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;
  const frontendOrigin =
    configService.get<string>('FRONTEND_ORIGIN')?.trim() ||
    'http://localhost:5173';

  app.setGlobalPrefix('api');
  app.enableCors({ origin: frontendOrigin });

  await app.listen(port);
}

void bootstrap();
