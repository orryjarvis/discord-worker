import { describe, it, expect, vi } from 'vitest';
import { discordService } from '../../src/services/discordService';

describe('discordService', () => {
  it('getInviteUrl returns correct url', () => {
    const url = discordService.getInviteUrl('app-id');
    expect(url).toBe('https://discord.com/oauth2/authorize?client_id=app-id&scope=applications.commands');
  });

  it('upsertCommands is callable', async () => {
    const fn = vi.fn();
    await discordService.upsertCommands('app-id', 'token', [], 'guild-id');
    expect(typeof discordService.upsertCommands).toBe('function');
  });
});
