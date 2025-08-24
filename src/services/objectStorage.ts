import { inject, injectable } from 'tsyringe';
import { Configuration } from '../config';

@injectable()
export class ObjectStorage {
  private readonly kv: KVNamespace;
  constructor(@inject(Configuration) private config: Configuration) {
    this.kv = config.get('KV')
  }

  private qualified_key(namespace: string, key: string): string {
    return `${namespace}: ${key}`;
  }

  async get(namespace: string, key: string): Promise<string | null> {
    return await this.kv.get(this.qualified_key(namespace, key))
  }

  async get_json(namespace: string, key: string): Promise<Object | null> {
    return await this.kv.get(this.qualified_key(namespace, key), 'json')
  }

  async put(namespace: string, key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    await this.kv.put(this.qualified_key(namespace, key), value, options)
  }
}
