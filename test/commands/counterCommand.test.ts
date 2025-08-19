import { describe, it, expect, vi } from 'vitest';
import { counterCommand } from '../../src/commands/counter';

const mockKV = {
  store: {} as Record<string, any>,
  async get(key: string) {
    return this.store[key] ? JSON.parse(this.store[key]) : null;
  },
  async put(key: string, value: string) {
    this.store[key] = value;
  },
};

describe('counterCommand', () => {
  it('returns counters for a valid hero', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes('/matchups')) {
        return {
          json: async () => [
            { hero_id: 2, games: 100, wins: 60 },
            { hero_id: 3, games: 100, wins: 55 },
          ],
        };
      }
      return {
        json: async () => [
          { id: 1, localized_name: 'Phantom Lancer' },
          { id: 2, localized_name: 'Axe' },
          { id: 3, localized_name: 'Lion' },
        ],
      };
    }) as any;
    const interaction = {
      data: {
        options: [{ name: 'hero', value: 'Phantom Lancer' }],
      },
    };
    const env = { kv: mockKV };
    const res = await counterCommand(interaction, env, {});
    const json = await res.json();
    expect(json.data.content).toMatch(/Top counters for \*\*Phantom Lancer\*\*: `Axe`, `Lion`/i);
  });

  it('handles missing hero name', async () => {
    const interaction = { data: { options: [] } };
    const env = { kv: mockKV };
    const res = await counterCommand(interaction, env, {});
    const json = await res.json();
    expect(json.data.content).toMatch(/please specify a hero name/i);
  });

  it('handles unknown hero', async () => {
    global.fetch = vi.fn(async () => ({ json: async () => [] })) as any;
    const interaction = {
      data: {
        options: [{ name: 'hero', value: 'NotARealHero' }],
      },
    };
    const env = { kv: mockKV };
    const res = await counterCommand(interaction, env, {});
    const json = await res.json();
    expect(json.data.content).toMatch(/Error:/i);
  });
});
