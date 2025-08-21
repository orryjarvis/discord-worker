import { describe, it, expect, vi } from 'vitest';
import { redditCommandHandler } from '../src/commands/reddit';
import { reactCommandHandler } from '../src/commands/react';
import { inviteCommandHandler } from '../src/commands/invite';
import { refreshCommandHandler } from '../src/commands/refresh';

const getRedditMedia = vi.fn(async (subreddit) => `https://reddit.com/r/${subreddit}`);
const react = vi.fn(async () => 1); // Return number instead of string to match expected type
const upsertCommands = vi.fn(async () => Promise.resolve()); // returns void to match expected type

const redditDeps = { redditService: { getMedia: getRedditMedia } };
const reactDeps = { reactService: { react } };
const inviteDeps = { discordService: { getInviteUrl: (id: string) => `https://discord.com/oauth2/authorize?client_id=${id}&scope=applications.commands` } };
const refreshDeps = { discordService: { upsertCommands }, commands: [] };
const env = {
  DISCORD_APPLICATION_ID: 'app-id',
  DISCORD_PUBLIC_KEY: 'public-key',
  DISCORD_TOKEN: 'token',
  DISCORD_GUILD_ID: 'guild-id',
  KV: {},
};

describe('Command Handlers Unit', () => {
  it('reddit handler returns media url', async () => {
    const interaction = {
      data: {
        name: 'reddit',
        type: 1,
        options: [{ name: 'subreddit', type: 3, value: 'funny' }],
      },
    };
    const res = await redditCommandHandler(interaction, env, redditDeps);
    expect(getRedditMedia).toHaveBeenCalledWith('funny');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('reddit.com/r/funny');
  });

  it('react handler returns reaction count', async () => {
    const interaction = {
      data: {
        name: 'react',
        type: 1,
        options: [{ name: 'emote', type: 3, value: 'smile' }],
      },
    };
    const res = await reactCommandHandler(interaction, env, reactDeps);
    expect(react).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('Reacted smile');
  });

  it('invite handler returns invite url', async () => {
    const interaction = { data: { name: 'invite' } };
    const res = await inviteCommandHandler(interaction, env, inviteDeps);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('discord.com/oauth2/authorize');
    expect(json.data.flags).toBe(64);
  });

  it('refresh handler returns refreshed message', async () => {
    const interaction = { data: { name: 'refresh' } };
    const res = await refreshCommandHandler(interaction, env, refreshDeps);
    expect(upsertCommands).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('commands refreshed');
  });

  it('reddit handler returns 400 for missing option', async () => {
    const interaction = {
      data: {
        name: 'reddit',
        type: 1,
        options: [],
      },
    };
    const res = await redditCommandHandler(interaction, env, redditDeps);
    expect(res.status).toBe(400);
  });

  it('react handler returns 400 for missing option', async () => {
    const interaction = {
      data: {
        name: 'react',
        type: 1,
        options: [],
      },
    };
    const res = await reactCommandHandler(interaction, env, reactDeps);
    expect(res.status).toBe(400);
  });
});
