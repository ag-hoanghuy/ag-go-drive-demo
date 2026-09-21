import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

interface OAuthStateEntry {
  demoSessionId: string;
  expiresAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class GoogleOAuthStateStore {
  private readonly states = new Map<string, OAuthStateEntry>();

  create(demoSessionId: string): string {
    this.deleteExpired();

    const state = randomBytes(32).toString('base64url');
    this.states.set(state, {
      demoSessionId,
      expiresAt: Date.now() + STATE_TTL_MS,
    });

    return state;
  }

  consume(state: string): string | undefined {
    const entry = this.states.get(state);
    this.states.delete(state);

    if (!entry || entry.expiresAt <= Date.now()) {
      return undefined;
    }

    return entry.demoSessionId;
  }

  private deleteExpired(): void {
    const now = Date.now();

    for (const [state, entry] of this.states.entries()) {
      if (entry.expiresAt <= now) {
        this.states.delete(state);
      }
    }
  }
}
