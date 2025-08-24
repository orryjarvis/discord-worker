import { describe, it, expect } from 'vitest';
import "../setup";
import { RefreshCommand } from '../../src/commands/refresh';
import { createMockDiscordService, createEnv } from '../setup';

describe('Refresh Command', () => {
  it('should refresh data', async () => {
    const interaction = { data: {} };
    const env = createEnv();
    const discordService = {
      ...createMockDiscordService(),
      getCommands: async () => [],
      deleteCommand: async () => {},
    };
    const command = new RefreshCommand(discordService);
    const res = await command.handle(interaction, env);
    const json = await res.json() as any;
    expect(json.data.content).toMatch(/refreshed/i);
  });
});
