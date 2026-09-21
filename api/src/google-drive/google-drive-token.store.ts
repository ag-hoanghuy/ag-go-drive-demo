import { Injectable } from '@nestjs/common';
import type { GoogleDriveCredentials } from './google-drive.types';

@Injectable()
export class GoogleDriveTokenStore {
  // Dữ liệu demo lưu trong memory và sẽ mất khi backend khởi động lại.
  private readonly credentialsBySession = new Map<
    string,
    GoogleDriveCredentials
  >();

  get(demoSessionId: string): GoogleDriveCredentials | undefined {
    return this.credentialsBySession.get(demoSessionId);
  }

  has(demoSessionId: string): boolean {
    return this.credentialsBySession.has(demoSessionId);
  }

  save(demoSessionId: string, credentials: GoogleDriveCredentials): void {
    this.credentialsBySession.set(demoSessionId, credentials);
  }

  update(
    demoSessionId: string,
    credentials: Partial<GoogleDriveCredentials>,
  ): void {
    const current = this.credentialsBySession.get(demoSessionId);

    if (!current) {
      return;
    }

    this.credentialsBySession.set(demoSessionId, {
      ...current,
      ...credentials,
    });
  }

  delete(demoSessionId: string): void {
    this.credentialsBySession.delete(demoSessionId);
  }
}
