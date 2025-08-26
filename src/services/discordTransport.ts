import { inject, injectable } from 'tsyringe';
import { Configuration } from '../config';

@injectable()
export class DiscordTransport {
  constructor(@inject(Configuration) private config: Configuration) {}

  async fetch(path: string, init: RequestInit): Promise<Response> {
    // If a Service Binding is present, use it; otherwise fall back to direct HTTP (keeps local OK until binding is configured)
    const maybe = (() => {
      try {
        return this.config.get('DISCORD_SERVICE') as unknown;
      } catch {
        return undefined;
      }
    })();
    const service = maybe as ServiceBinding | undefined;
    if (service && typeof service.fetch === 'function') {
      const base = 'https://discord.com/api/v10';
      const url = new URL(path, base).toString();
      return await service.fetch(url, init);
    }

    // Fallback direct
    const base = (this.config.get('DISCORD_API_BASE') as string) || 'https://discord.com/api/v10';
    const url = new URL(path, base).toString();
    return await fetch(url, init);
  }
}

type ServiceBinding = {
  fetch: (input: Request | string, init?: RequestInit) => Promise<Response>;
};
