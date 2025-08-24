import "reflect-metadata";
import { describe, it, expect, vi } from 'vitest';
import { RedditCommand } from '../src/commands/reddit';
import { ReactCommand } from '../src/commands/react';
import { InviteCommand } from '../src/commands/invite';
import { RefreshCommand } from '../src/commands/refresh';
import { mockKV } from './setup';

const getRedditMedia = vi.fn(async (subreddit) => `https://reddit.com/r/${subreddit}`);
const react = vi.fn(async () => '1');
const upsertCommands = vi.fn(async () => Promise.resolve(new Response('commands refreshed')));
const getInviteUrl = vi.fn((id: string) => `https://discord.com/oauth2/authorize?client_id=${id}&scope=applications.commands`);

const redditService = { getMedia: getRedditMedia };
const reactService = { react };
const discordService = {
  getInviteUrl,
  upsertCommands,
  getCommands: async () => [],
  deleteCommand: async () => {},
};
const env = {
  DISCORD_APPLICATION_ID: 'app-id',
  DISCORD_PUBLIC_KEY: 'public-key',
  DISCORD_TOKEN: 'token',
  DISCORD_GUILD_ID: 'guild-id',
  KV: mockKV,
};

describe('Command Handlers Unit', () => {
  it('reddit handler returns media url', async () => {
    const interaction = {
      data: {
        type: 1,
        options: [{ name: 'subreddit', type: 3, value: 'funny' }],
      },
    };
    const command = new RedditCommand(redditService);
    const res = await command.handle(interaction, env);
    expect(getRedditMedia).toHaveBeenCalledWith('funny');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('reddit.com/r/funny');
  });

  it('react handler returns reaction count', async () => {
    const interaction = {
      data: {
        type: 1,
        options: [{ name: 'emote', type: 3, value: 'smile' }],
      },
    };
    const command = new ReactCommand(reactService);
    const res = await command.handle(interaction, env);
    expect(react).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('Reacted smile');
  });

  it('invite handler returns invite url', async () => {
    const interaction = { data: {} };
    const command = new InviteCommand(discordService);
    const res = await command.handle(interaction, env);
    expect(getInviteUrl).toHaveBeenCalledWith('app-id');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('discord.com/oauth2/authorize');
    expect(json.data.flags).toBe(64);
  });

  it('refresh handler returns refreshed message', async () => {
    const interaction = { data: {} };
    const command = new RefreshCommand(discordService);
    const res = await command.handle(interaction, env);
    expect(upsertCommands).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('commands refreshed');
  });

  it('reddit handler returns 400 for missing option', async () => {
    const interaction = {
      data: {
        type: 1,
        options: [],
      },
    };
    const command = new RedditCommand(redditService);
    const res = await command.handle(interaction, env);
    expect(res.status).toBe(400);
  });

  it('react handler returns 400 for missing option', async () => {
    const interaction = {
      data: {
        type: 1,
        options: [],
      },
    };
    const command = new ReactCommand(reactService);
    const res = await command.handle(interaction, env);
    expect(res.status).toBe(400);
  });
});
