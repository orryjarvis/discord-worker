import { describe, it, expect, vi } from 'vitest';
import { refreshCommandHandler } from '../../src/commands/refresh';

const upsertCommands = vi.fn(async () => {});
const mockDeps = {
  discordService: {
    upsertCommands,
  },
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
    const res = await refreshCommandHandler(interaction, mockEnv, mockDeps);
    expect(upsertCommands).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('commands refreshed');
  });
});
