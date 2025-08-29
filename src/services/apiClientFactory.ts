import createClient, { type Client } from 'openapi-fetch';
import { inject, injectable } from 'tsyringe';
import type { Env } from '../types';

// Simple factory to create typed OpenAPI clients with shared options
// - baseUrl: API base
// - headers: optional default headers applied per request
@injectable()
export class ApiClientFactory<T extends {}> {
    constructor(@inject('Env') private env: Env) { }

    create(): Client<T> {
        return createClient<T>({ baseUrl: this.env.OPENDOTA_URL, fetch });
    }
}
