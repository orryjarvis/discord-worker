import { inject, injectable, registry, type InjectionToken } from 'tsyringe';
import type { Env } from '../types';

export interface BaseUrlProvider {
  getBaseUrl(id: string): string;
}

// DI token for the provider so projects can override if needed
export const BaseUrlProviderToken = 'BaseUrlProvider' as InjectionToken<BaseUrlProvider>;

// Default implementation that maps an api id to an ENV var following the pattern: <ID>_URL
// ID is transformed to UPPER_SNAKE_CASE.
@injectable()
export class EnvBaseUrlProvider implements BaseUrlProvider {
  constructor(@inject('Env') private env: Env) {}

  getBaseUrl(id: string): string {
    const toUpperSnake = (s: string) =>
      s
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // fooBar -> foo_Bar
        .replace(/[-\s]+/g, '_') // dash/space to underscore
        .toUpperCase();
    const key = `${toUpperSnake(id)}_URL`;
    const url = (this.env as any)[key];
    if (!url) throw new Error(`Missing base URL for '${id}'. Set ${key} in Env.`);
    return url as string;
  }
}

// Auto-register default provider; consumers can re-register the token to override.
@registry([
  { token: BaseUrlProviderToken, useClass: EnvBaseUrlProvider },
])
export class BaseUrlProviderModule {}
