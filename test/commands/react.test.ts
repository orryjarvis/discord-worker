import { describe, it, expect } from 'vitest';
import { reactCommandHandler } from '../../src/commands/react';

const mockDeps = {
  reactService: {
    react: async (emote: string, env: any) => 42,
  },
};
const mockEnv = {};

describe('reactCommandHandler', () => {
  it('returns reaction count for valid emote', async () => {
    const interaction = {
      data: {
        type: 1,
        options: [{ name: 'emote', type: 3, value: 'smile' }],
      },
    };
    const res = await reactCommandHandler(interaction, mockEnv, mockDeps);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('Reacted smile');
  });

  it('returns 400 for missing option', async () => {
    const interaction = { data: { type: 1, options: [] } };
    const res = await reactCommandHandler(interaction, mockEnv, mockDeps);
    expect(res.status).toBe(400);
  });
});
