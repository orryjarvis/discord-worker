import "reflect-metadata";
import { describe, it, expect, vi } from 'vitest';
import { DiscordService } from '../../src/services/discordService';

describe('discordService', () => {
  it('getInviteUrl returns correct url', () => {
    const url = new DiscordService().getInviteUrl('app-id');
    expect(url).toBe('https://discord.com/oauth2/authorize?client_id=app-id&scope=applications.commands');
  });
});
