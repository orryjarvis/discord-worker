import { SessionState } from './effects';

export interface SessionStore {
  load(sessionKey: string): Promise<SessionState | null>;
  save(sessionKey: string, session: SessionState): Promise<void>;
  delete(sessionKey: string): Promise<void>;
}

export function createEmptySession(sessionKey: string): SessionState {
  return {
    id: sessionKey,
    status: 'new',
    data: {},
    updatedAt: new Date().toISOString(),
  };
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionState>();

  async load(sessionKey: string): Promise<SessionState | null> {
    return this.sessions.get(sessionKey) ?? null;
  }

  async save(sessionKey: string, session: SessionState): Promise<void> {
    this.sessions.set(sessionKey, session);
  }

  async delete(sessionKey: string): Promise<void> {
    this.sessions.delete(sessionKey);
  }
}
