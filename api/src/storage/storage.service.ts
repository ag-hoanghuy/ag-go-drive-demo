import type { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageStatus, UploadedObject } from './storage.types';

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
}

interface UploadStreamOptions {
  pathSegments: string[];
  body: Readable;
  contentType: string;
}

@Injectable()
export class StorageService {
  private client: S3Client | undefined;

  constructor(private readonly configService: ConfigService) {}

  getStatus(): StorageStatus {
    const config = this.readConfig();
    return {
      configured: config !== undefined,
      bucket: config?.bucket ?? null,
    };
  }

  ensureConfigured(): void {
    this.getConfig();
  }

  async uploadStream(options: UploadStreamOptions): Promise<UploadedObject> {
    const config = this.getConfig();
    const key = this.createObjectKey(options.pathSegments);
    const upload = new Upload({
      client: this.getClient(config),
      params: {
        Bucket: config.bucket,
        Key: key,
        Body: options.body,
        ContentType: options.contentType,
      },
      queueSize: 3,
      partSize: 5 * 1024 * 1024,
      leavePartsOnError: false,
    });
    const result = await upload.done();

    return {
      key,
      bucket: config.bucket,
      etag: result.ETag ?? null,
    };
  }

  createObjectKey(pathSegments: string[]): string {
    const safePath = pathSegments.map((segment) => this.sanitizeSegment(segment));

    return ['google-drive', ...safePath].join('/');
  }

  private getClient(config: R2Config): S3Client {
    this.client ??= new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    return this.client;
  }

  private getConfig(): R2Config {
    const config = this.readConfig();

    if (!config) {
      throw new ServiceUnavailableException(
        'Cloudflare R2 chưa được cấu hình đầy đủ',
      );
    }

    return config;
  }

  private readConfig(): R2Config | undefined {
    const accountId = this.readValue('R2_ACCOUNT_ID');
    const accessKeyId = this.readValue('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.readValue('R2_SECRET_ACCESS_KEY');
    const bucket = this.readValue('R2_BUCKET');
    const endpoint = this.readValue('R2_ENDPOINT');

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !endpoint
    ) {
      return undefined;
    }

    return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
  }

  private readValue(name: string): string | undefined {
    return this.configService.get<string>(name)?.trim() || undefined;
  }

  private sanitizeSegment(value: string): string {
    const withoutControlCharacters = Array.from(
      value.normalize('NFKC'),
      (character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127 ? '_' : character;
      },
    ).join('');
    const sanitized = withoutControlCharacters
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/^\.+$/, '_')
      .trim();

    return sanitized.slice(0, 180) || 'unnamed';
  }
}
