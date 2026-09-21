import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import {
  GoogleDriveService,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
} from '../google-drive/google-drive.service';
import type { GoogleDriveFileEntry } from '../google-drive/google-drive.types';
import { StorageService } from '../storage/storage.service';
import type {
  GoogleDriveImportResult,
  ImportedFile,
  ImportFileError,
} from './import.types';

const IMPORT_CONCURRENCY = 3;
const GOOGLE_NATIVE_FILE_REASON =
  'Google native file is not supported in this demo';

type FileImportOutcome =
  | { file: ImportedFile; error?: never }
  | { file?: never; error: ImportFileError };

@Injectable()
export class ImportService {
  constructor(
    private readonly googleDriveService: GoogleDriveService,
    private readonly storageService: StorageService,
  ) {}

  async importGoogleDriveItem(
    demoSessionId: string,
    itemId: string,
  ): Promise<GoogleDriveImportResult> {
    this.storageService.ensureConfigured();

    const selectedItem = await this.googleDriveService.getItem(
      demoSessionId,
      itemId,
    );
    const type = selectedItem.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE
      ? 'folder'
      : 'file';
    const entries = selectedItem.isFolder
      ? await this.googleDriveService.collectFolderFiles(
          demoSessionId,
          selectedItem,
        )
      : [{ item: selectedItem, pathSegments: [selectedItem.name] }];
    const outcomes = await this.mapWithConcurrency(
      entries,
      IMPORT_CONCURRENCY,
      (entry) => this.importFile(demoSessionId, entry),
    );
    const files = outcomes.flatMap((outcome) =>
      outcome.file ? [outcome.file] : [],
    );
    const errors = outcomes.flatMap((outcome) =>
      outcome.error ? [outcome.error] : [],
    );

    return {
      type,
      totalFiles: entries.length,
      uploaded: files.length,
      failed: errors.length,
      files,
      errors,
    };
  }

  private async importFile(
    demoSessionId: string,
    entry: GoogleDriveFileEntry,
  ): Promise<FileImportOutcome> {
    if (this.googleDriveService.isGoogleNativeFile(entry.item)) {
      return {
        error: {
          driveFileId: entry.item.id,
          name: entry.item.name,
          reason: GOOGLE_NATIVE_FILE_REASON,
        },
      };
    }

    let stream: Readable | undefined;

    try {
      stream = await this.googleDriveService.downloadFile(
        demoSessionId,
        entry.item.id,
      );
      const uploadedObject = await this.storageService.uploadStream({
        pathSegments: entry.pathSegments,
        body: stream,
        contentType: entry.item.mimeType || 'application/octet-stream',
      });

      return {
        file: {
          driveFileId: entry.item.id,
          name: entry.item.name,
          r2Key: uploadedObject.key,
          mimeType: entry.item.mimeType,
          size: entry.item.size,
        },
      };
    } catch {
      stream?.destroy();
      return {
        error: {
          driveFileId: entry.item.id,
          name: entry.item.name,
          reason: 'Không thể tải hoặc upload file',
        },
      };
    }
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const item = items[currentIndex];

        if (item !== undefined) {
          results[currentIndex] = await mapper(item);
        }
      }
    };

    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(
      Array.from({ length: workerCount }, () => worker()),
    );
    return results;
  }
}
