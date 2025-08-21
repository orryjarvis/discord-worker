import { describe, it, expect, vi } from 'vitest';
import { InviteCommand } from '../../src/commands/invite';

const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  list: vi.fn(),
  getWithMetadata: vi.fn(),
  delete: vi.fn(),
};
const mockDiscordService = {
  getInviteUrl: vi.fn(() => 'https://discord.gg/invite-code'), // returns string
  upsertCommands: vi.fn(),
  getCommands: vi.fn(),
  deleteCommand: vi.fn(),
};
const mockEnv = {
  DISCORD_APPLICATION_ID: 'app-id',
  DISCORD_TOKEN: 'token',
  DISCORD_GUILD_ID: 'guild-id',
  DISCORD_PUBLIC_KEY: 'public-key',
  KV: mockKV,
};

describe('inviteCommandHandler', () => {
  it('creates an invite and returns the invite URL', async () => {
    const interaction = { data: {} };
    const res = await new InviteCommand(mockDiscordService).handle(interaction, mockEnv);
    expect(mockDiscordService.getInviteUrl).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('https://discord.gg/invite-code');
  });
});
