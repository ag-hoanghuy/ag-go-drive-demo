import { Injectable } from '@nestjs/common';
import type { GoogleDriveCredentials } from './google-drive.types';

@Injectable()
export class GoogleDriveTokenStore {
  // Dữ liệu demo lưu trong memory và sẽ mất khi backend khởi động lại.
  private readonly credentialsBySubject = new Map<
    string,
    GoogleDriveCredentials
  >();

  get(subject: string): GoogleDriveCredentials | undefined {
    return this.credentialsBySubject.get(subject);
  }

  has(subject: string): boolean {
    return this.credentialsBySubject.has(subject);
  }

  save(subject: string, credentials: GoogleDriveCredentials): void {
    this.credentialsBySubject.set(subject, credentials);
  }

  update(
    subject: string,
    credentials: Partial<GoogleDriveCredentials>,
  ): void {
    const current = this.credentialsBySubject.get(subject);

    if (!current) {
      return;
    }

    this.credentialsBySubject.set(subject, {
      ...current,
      ...credentials,
    });
  }

  delete(subject: string): void {
    this.credentialsBySubject.delete(subject);
  }
}
