import type { Env } from './types';

export class Configuration {
    private config: Map<string, unknown>;

    constructor(env: Env) {
        this.config = new Map(Object.entries(env));
    }

    get(key: string): unknown {
        if(this.config.has(key)) {
            return this.config.get(key);
        }
        throw new Error(`Config value ${key} not found`)
    }
}
