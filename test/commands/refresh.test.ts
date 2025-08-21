import { describe, it, expect, vi } from 'vitest';
import { RefreshCommand } from '../../src/commands/refresh';

const mockDiscordService = {
  upsertCommands: vi.fn(async () => Promise.resolve()),
};
const mockDeps = {
  discordService: mockDiscordService,
  commands: [],
};
const mockEnv = {
  DISCORD_APPLICATION_ID: 'app-id',
  DISCORD_TOKEN: 'token',
  DISCORD_GUILD_ID: 'guild-id',
};

describe('refreshCommandHandler', () => {
  it('calls upsertCommands and returns refreshed message', async () => {
    const interaction = { data: {} };
    const res = await new RefreshCommand(mockDeps).handle(interaction, mockEnv);
    expect(mockDiscordService.upsertCommands).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('commands refreshed');
  });
});
