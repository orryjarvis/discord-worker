import { describe, it, expect } from 'vitest';
import { inviteCommandHandler } from '../../src/commands/invite';

const mockDeps = {
  discordService: {
    getInviteUrl: (applicationId: string) => `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`,
  },
};
const mockEnv = { DISCORD_APPLICATION_ID: 'app-id' };

describe('inviteCommandHandler', () => {
  it('returns invite url', async () => {
    const interaction = { data: {} };
    const res = await inviteCommandHandler(interaction, mockEnv, mockDeps);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('discord.com/oauth2/authorize');
    expect(json.data.flags).toBe(64);
  });
});
