import { Readable } from 'node:stream';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { drive_v3, google } from 'googleapis';
import { GoogleOAuthClientFactory } from './google-oauth-client.factory';
import type {
  GoogleDriveFileEntry,
  GoogleDriveItem,
} from './google-drive.types';

export const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  'application/vnd.google-apps.folder';
export const GOOGLE_NATIVE_MIME_TYPE_PREFIX = 'application/vnd.google-apps.';

const ITEM_FIELDS = 'id,name,mimeType,size,modifiedTime,iconLink';

@Injectable()
export class GoogleDriveService {
  constructor(private readonly oauthClientFactory: GoogleOAuthClientFactory) {}

  async listItems(
    subject: string,
    parentId?: string,
  ): Promise<GoogleDriveItem[]> {
    const drive = this.createDriveClient(subject);
    const items: GoogleDriveItem[] = [];
    let pageToken: string | undefined;
    const parent = parentId?.trim() || 'root';

    try {
      do {
        const response = await drive.files.list({
          q: `'${this.escapeQueryValue(parent)}' in parents and trashed = false`,
          fields: `nextPageToken,files(${ITEM_FIELDS})`,
          pageSize: 1000,
          pageToken,
          spaces: 'drive',
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        });

        items.push(...(response.data.files ?? []).map((file) => this.mapItem(file)));
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (error: unknown) {
      this.throwGoogleApiError(error, 'Không thể đọc nội dung Google Drive');
    }

    return items.sort((left, right) => {
      if (left.isFolder !== right.isFolder) {
        return left.isFolder ? -1 : 1;
      }

      return left.name.localeCompare(right.name, 'vi', {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }

  async getItem(subject: string, itemId: string): Promise<GoogleDriveItem> {
    const drive = this.createDriveClient(subject);

    try {
      const response = await drive.files.get({
        fileId: itemId,
        fields: ITEM_FIELDS,
        supportsAllDrives: true,
      });
      return this.mapItem(response.data);
    } catch (error: unknown) {
      this.throwGoogleApiError(error, 'Không thể đọc Google Drive item');
    }
  }

  async collectFolderFiles(
    subject: string,
    folder: GoogleDriveItem,
  ): Promise<GoogleDriveFileEntry[]> {
    const files: GoogleDriveFileEntry[] = [];
    const folders: Array<{ id: string; pathSegments: string[] }> = [
      { id: folder.id, pathSegments: [folder.name] },
    ];

    for (let index = 0; index < folders.length; index += 1) {
      const current = folders[index];

      if (!current) {
        continue;
      }

      const children = await this.listItems(subject, current.id);

      for (const child of children) {
        const pathSegments = [...current.pathSegments, child.name];

        if (child.isFolder) {
          folders.push({ id: child.id, pathSegments });
        } else {
          files.push({ item: child, pathSegments });
        }
      }
    }

    return files;
  }

  async downloadFile(subject: string, fileId: string): Promise<Readable> {
    const drive = this.createDriveClient(subject);

    try {
      const response = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' },
      );

      if (!(response.data instanceof Readable)) {
        throw new BadGatewayException('Google Drive không trả về file stream');
      }

      return response.data;
    } catch (error: unknown) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      this.throwGoogleApiError(error, 'Không thể tải file từ Google Drive');
    }
  }

  isGoogleNativeFile(item: GoogleDriveItem): boolean {
    return (
      !item.isFolder && item.mimeType.startsWith(GOOGLE_NATIVE_MIME_TYPE_PREFIX)
    );
  }

  private createDriveClient(subject: string): drive_v3.Drive {
    return google.drive({
      version: 'v3',
      auth: this.oauthClientFactory.createForSubject(subject),
    });
  }

  private mapItem(file: drive_v3.Schema$File): GoogleDriveItem {
    if (!file.id || !file.name || !file.mimeType) {
      throw new BadGatewayException('Google Drive trả về metadata không hợp lệ');
    }

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      isFolder: file.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE,
      size: file.size ? Number(file.size) : null,
      modifiedTime: file.modifiedTime ?? null,
      iconLink: file.iconLink ?? null,
    };
  }

  private escapeQueryValue(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  }

  private throwGoogleApiError(error: unknown, fallbackMessage: string): never {
    const status = this.getErrorStatus(error);
    const message = error instanceof Error ? error.message : '';

    if (status === 404) {
      throw new NotFoundException('Google Drive item không tồn tại');
    }

    if (
      status === 401 ||
      message.includes('invalid_grant') ||
      message.includes('Invalid Credentials')
    ) {
      throw new BadRequestException(
        'Google Drive token đã hết hạn. Hãy kết nối lại Google Drive.',
      );
    }

    throw new BadGatewayException(fallbackMessage);
  }

  private getErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) {
      return undefined;
    }

    const candidate = error as {
      code?: number;
      response?: { status?: number };
    };
    return candidate.response?.status ?? candidate.code;
  }
}
