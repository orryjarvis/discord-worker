import { describe, it, expect, vi } from 'vitest';
import { DotaService } from '../../src/services/dotaService';

const mockKV = {
  store: {} as Record<string, any>,
  async get(key: string) {
    return this.store[key] ? JSON.parse(this.store[key]) : null;
  },
  async put(key: string, value: string) {
    this.store[key] = value;
  },
};

describe('DotaService', () => {
  it('returns hero id by name', async () => {
    global.fetch = vi.fn(async () => ({
      json: async () => [
        { id: 1, localized_name: 'Phantom Lancer' },
        { id: 2, localized_name: 'Axe' },
      ],
    })) as any;
    const service = new DotaService(mockKV as any);
    const id = await service.getHeroIdByName('Phantom Lancer');
    expect(id).toBe(1);
  });

  it('returns top counters for a hero', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes('/matchups')) {
        return {
          json: async () => [
            { hero_id: 2, games_played: 100, wins: 60 }, // Axe
            { hero_id: 3, games_played: 100, wins: 55 }, // Lion
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
    const service = new DotaService(mockKV as any);
    const counters = await service.getHeroCounters('Phantom Lancer');
    expect(counters).toEqual(['Lion', 'Axe']);
  });

  it('caches counters in KV', async () => {
    let fetchCount = 0;
    global.fetch = vi.fn(async (url: string) => {
      fetchCount++;
      if (url.includes('/matchups')) {
        return {
          json: async () => [
            { hero_id: 2, games_played: 100, wins: 60 },
          ],
        };
      }
      return {
        json: async () => [
          { id: 1, localized_name: 'Phantom Lancer' },
          { id: 2, localized_name: 'Axe' },
        ],
      };
    }) as any;
    const service = new DotaService(mockKV as any);
    await service.getHeroCounters('Phantom Lancer');
    await service.getHeroCounters('Phantom Lancer'); // Should hit cache
    expect(fetchCount).toBeLessThanOrEqual(2); // Only one fetch per endpoint
  });
});
