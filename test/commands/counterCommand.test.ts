import { describe, it, expect, vi } from 'vitest';
import { CounterCommand } from '../../src/commands/counter';

const mockKV = {
  store: {} as Record<string, any>,
  async get(key: string) {
    return this.store[key] ? JSON.parse(this.store[key]) : null;
  },
  async put(key: string, value: string) {
    this.store[key] = value;
  },
};

const mockDotaService = {
  kv: mockKV as unknown as KVNamespace<string>,
  getHeroIdByName: vi.fn(async (name: string) => {
    if (name === 'Phantom Lancer') return 1;
    if (name === 'Axe') return 2;
    if (name === 'Lion') return 3;
    return null;
  }),
  getHeroCounters: vi.fn(async (heroName: string, topN?: number) => {
    if (heroName === 'Phantom Lancer') {
      return ['Lion', 'Axe'];
    }
    return [];
  }),
};

function createEnv() {
  return {
    DISCORD_APPLICATION_ID: 'test-app-id',
    DISCORD_PUBLIC_KEY: 'test-public-key',
    DISCORD_GUILD_ID: 'test-guild-id',
    DISCORD_TOKEN: 'test-token',
    KV: mockKV as unknown as KVNamespace<string>,
    kv: mockKV as unknown as KVNamespace<string>, // for legacy compatibility if needed
  };
}

describe('counterCommand', () => {
  function createCounterCommand(service = mockDotaService) {
    // If CounterCommand expects a service, inject a mock here
    // Example: new CounterCommand({ dotaService: mockDotaService })
    // For now, pass mockKV as dependency
    return new CounterCommand(service);
  }

  it('returns counters for a valid hero', async () => {
    const interaction = {
      data: {
        options: [{ name: 'hero', value: 'Phantom Lancer' }],
      },
    };
    const env = createEnv();
    const res = await createCounterCommand().handle(interaction, env);
    const json = await res.json() as any;
    expect(json.data.content).toMatch(/Top counters for \*\*Phantom Lancer\*\*: `Lion`, `Axe`/i);
  });

  it('handles missing hero name', async () => {
    const interaction = { data: { options: [] } };
    const env = createEnv();
    const res = await createCounterCommand().handle(interaction, env);
    const json = await res.json() as any;
    expect(json.data.content).toMatch(/please specify a hero name/i);
  });

  it('handles unknown hero', async () => {
    const unknownHeroService = {
      ...mockDotaService,
      getHeroIdByName: vi.fn(async () => null),
      getHeroCounters: vi.fn(async () => []),
      kv: mockKV as unknown as KVNamespace<string>,
    };
    const interaction = {
      data: {
        options: [{ name: 'hero', value: 'NotARealHero' }],
      },
    };
    const env = createEnv();
    const res = await createCounterCommand(unknownHeroService).handle(interaction, env);
    const json = await res.json() as any;
    expect(json.data.content).toMatch(/Error:/i);
  });
});
