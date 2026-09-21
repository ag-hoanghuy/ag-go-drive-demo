export interface StorageStatus {
  configured: boolean;
  bucket: string | null;
}

export interface UploadedObject {
  key: string;
  bucket: string;
  etag: string | null;
}

