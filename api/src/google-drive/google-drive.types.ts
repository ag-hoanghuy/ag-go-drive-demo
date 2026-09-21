export interface GoogleDriveCredentials {
  accessToken: string | null;
  refreshToken: string | null;
  expiryDate: number | null;
}

export interface GoogleDriveConnectionStatus {
  connected: boolean;
}

export interface GoogleAuthorizationResponse {
  authorizationUrl: string;
}

export type GoogleCallbackResult = 'connected' | 'error';

export interface GoogleDriveItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
  iconLink: string | null;
}

export interface GoogleDriveFileEntry {
  item: GoogleDriveItem;
  pathSegments: string[];
}
