import { describe, it, expect } from 'vitest';
import "../setup";
import { InviteCommand } from '../../src/commands/invite';
import { createMockDiscordService, createEnv } from '../setup';

describe('Invite Command', () => {
  it('should generate an invite', async () => {
    const interaction = { data: {} };
    const env = createEnv();
    // Ensure all required DiscordService methods are present
    const discordService = {
      ...createMockDiscordService(),
      getCommands: () => [],
      deleteCommand: () => {},
    };
    const command = new InviteCommand(discordService);
    const res = await command.handle(interaction, env);
    const json = await res.json() as any;
    expect(json.data.content).toContain('https://discord.gg');
  });
});
  // ...existing code...
  // ...existing code...
