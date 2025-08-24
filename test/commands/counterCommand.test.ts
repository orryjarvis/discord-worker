import "../setup";
import { describe, it, expect, vi } from 'vitest';
import { CounterCommand } from '../../src/commands/counter';
import { createMockDotaService, createEnv } from '../setup';

// ...existing code...

describe('counterCommand', () => {
  function createCounterCommand(service = createMockDotaService()) {
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
      ...createMockDotaService(),
      getHeroIdByName: vi.fn(async () => null),
      getHeroCounters: vi.fn(async (heroName: string, kv: any, topN?: number) => []),
    };
    const interaction = {
      data: {
        options: [{ name: 'hero', value: 'NotARealHero' }],
      },
    };
    const env = createEnv();
    const res = await createCounterCommand(unknownHeroService).handle(interaction, env);
    const json = await res.json() as any;
  expect(json.data.content).toMatch(/No counters found for "NotARealHero"\./i);
  });
});
