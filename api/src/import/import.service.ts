import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { GoogleDriveService } from '../google-drive/google-drive.service';
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

  async importGoogleDriveItems(
    demoSessionId: string,
    itemIds: string[],
  ): Promise<GoogleDriveImportResult> {
    this.storageService.ensureConfigured();

    const uniqueItemIds = [...new Set(itemIds)];
    const selectionErrors: ImportFileError[] = [];
    const collectedEntries: GoogleDriveFileEntry[] = [];

    for (const itemId of uniqueItemIds) {
      try {
        const selectedItem = await this.googleDriveService.getItem(
          demoSessionId,
          itemId,
        );
        const entries = selectedItem.isFolder
          ? await this.googleDriveService.collectFolderFiles(
              demoSessionId,
              selectedItem,
            )
          : [{ item: selectedItem, pathSegments: [selectedItem.name] }];

        collectedEntries.push(...entries);
      } catch {
        selectionErrors.push({
          driveFileId: itemId,
          name: itemId,
          reason: 'Không thể đọc item đã chọn',
        });
      }
    }

    const entries = this.createUniqueEntries(collectedEntries);
    const outcomes = await this.mapWithConcurrency(
      entries,
      IMPORT_CONCURRENCY,
      (entry) => this.importFile(demoSessionId, entry),
    );
    const files = outcomes.flatMap((outcome) =>
      outcome.file ? [outcome.file] : [],
    );
    const errors = [
      ...selectionErrors,
      ...outcomes.flatMap((outcome) =>
        outcome.error ? [outcome.error] : [],
      ),
    ];

    return {
      selectedItems: uniqueItemIds.length,
      totalFiles: entries.length + selectionErrors.length,
      uploaded: files.length,
      failed: errors.length,
      files,
      errors,
    };
  }

  private createUniqueEntries(
    entries: GoogleDriveFileEntry[],
  ): GoogleDriveFileEntry[] {
    const entriesByFileId = new Map<string, GoogleDriveFileEntry>();

    for (const entry of entries) {
      if (!entriesByFileId.has(entry.item.id)) {
        entriesByFileId.set(entry.item.id, entry);
      }
    }

    const usedKeys = new Set<string>();

    return [...entriesByFileId.values()].map((entry) => {
      if (this.googleDriveService.isGoogleNativeFile(entry.item)) {
        return entry;
      }

      let pathSegments = entry.pathSegments;
      let key = this.storageService.createObjectKey(pathSegments);
      let attempt = 1;

      while (usedKeys.has(key)) {
        pathSegments = this.addCollisionSuffix(entry, attempt);
        key = this.storageService.createObjectKey(pathSegments);
        attempt += 1;
      }

      usedKeys.add(key);
      return { ...entry, pathSegments };
    });
  }

  private addCollisionSuffix(
    entry: GoogleDriveFileEntry,
    attempt: number,
  ): string[] {
    const originalName = entry.pathSegments.at(-1) ?? entry.item.name;
    const dotIndex = originalName.lastIndexOf('.');
    const hasExtension = dotIndex > 0;
    const baseName = hasExtension
      ? originalName.slice(0, dotIndex)
      : originalName;
    const extension = hasExtension
      ? originalName.slice(dotIndex, dotIndex + 31)
      : '';
    const safeId = entry.item.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(-12);
    const attemptSuffix = attempt > 1 ? `-${attempt}` : '';
    const uniqueName = `${baseName.slice(0, 120)}--${safeId || 'file'}${attemptSuffix}${extension}`;

    return [...entry.pathSegments.slice(0, -1), uniqueName];
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
