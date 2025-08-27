import { inject, injectable } from 'tsyringe';
import type { Env } from '../types.js';

@injectable()
export class ObjectStorage {
  private readonly kv: KVNamespace;
  constructor(@inject('Env') private env: Env) {
    this.kv = this.env.KV;
  }

  private qualified_key(namespace: string, key: string): string {
    return `${namespace}: ${key}`;
  }

  async get(namespace: string, key: string): Promise<string | null> {
    return await this.kv.get(this.qualified_key(namespace, key))
  }

  async get_json(namespace: string, key: string): Promise<object | null> {
    return await this.kv.get(this.qualified_key(namespace, key), 'json')
  }

  async put(namespace: string, key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    await this.kv.put(this.qualified_key(namespace, key), value, options)
  }
}
