export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
  iconLink: string | null;
}

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
  type: 'file' | 'folder';
  totalFiles: number;
  uploaded: number;
  failed: number;
  files: ImportedFile[];
  errors: ImportFileError[];
}

