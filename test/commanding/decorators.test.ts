import { describe, it, expect } from 'vitest';
import { Slash, StringOpt, slashCommandDefinitions } from '../../src/commanding/decorators.js';
import { z } from 'zod';

describe('decorators', () => {
  it('builds command definition from schema describe() and required', async () => {
    const input = z.object({ subreddit: z.string().min(1).describe('desc') });
    @Slash({ name: 'test', description: 'Test', input })
    class Cmd {}
    await Promise.resolve();
    const def = slashCommandDefinitions.find(d => d.name === 'test');
    expect(def).toBeTruthy();
    expect(def?.options?.[0]).toMatchObject({ name: 'subreddit', description: 'desc', required: true, type: 3 });
  });

  it('StringOpt overrides schema-derived metadata', async () => {
    const input = z.object({ subreddit: z.string() });
    @StringOpt({ name: 'subreddit', description: 'override', required: false })
    @Slash({ name: 'opt', description: 'Opt', input })
    class Cmd2 {}
    await Promise.resolve();
    const def = slashCommandDefinitions.find(d => d.name === 'opt');
    expect(def?.options?.[0]).toMatchObject({ description: 'override', required: false });
  });
});
