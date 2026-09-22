export interface ImportedFile {
  driveFileId: string;
  name: string;
  r2Key: string;
  mimeType: string;
  size: number | null;
}

export interface ImportFileError {
  driveFileId: string;
  name: string;
  reason: string;
}

export interface GoogleDriveImportResult {
  selectedItems: number;
  totalFiles: number;
  uploaded: number;
  failed: number;
  files: ImportedFile[];
  errors: ImportFileError[];
}
