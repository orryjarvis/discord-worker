import { SessionState } from '../../core/effects.js';
import { SessionStore } from '../../core/session.js';

export class KvSessionStore implements SessionStore {
  constructor(private readonly kv: KVNamespace) {}

  async load(sessionKey: string): Promise<SessionState | null> {
    return (await this.kv.get<SessionState>(sessionKey, 'json')) ?? null;
  }

  async save(sessionKey: string, session: SessionState): Promise<void> {
    await this.kv.put(sessionKey, JSON.stringify(session));
  }

  async delete(sessionKey: string): Promise<void> {
    await this.kv.delete(sessionKey);
  }
}
