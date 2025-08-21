import { describe, it, expect, vi } from 'vitest';
import { ReactCommand } from '../../src/commands/react';

const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  list: vi.fn(),
  getWithMetadata: vi.fn(),
  delete: vi.fn(),
};
const mockReactService = {
  addReaction: vi.fn(async (messageId: string, emoji: string) => true),
  react: vi.fn(),
};
const mockDeps = mockReactService;
const mockEnv = {
  DISCORD_APPLICATION_ID: 'app-id',
  DISCORD_TOKEN: 'token',
  DISCORD_GUILD_ID: 'guild-id',
  DISCORD_PUBLIC_KEY: 'public-key',
  KV: mockKV,
};

describe('reactCommandHandler', () => {
  it('adds a reaction to a message', async () => {
    const interaction = { data: { options: [{ name: 'messageId', value: '123' }, { name: 'emoji', value: '👍' }] } };
    const res = await new ReactCommand(mockDeps).handle(interaction, mockEnv);
    expect(mockReactService.addReaction).toHaveBeenCalledWith('123', '👍');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('Reaction added');
  });
});
