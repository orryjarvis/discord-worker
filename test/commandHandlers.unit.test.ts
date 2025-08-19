import { describe, it, expect, vi } from 'vitest';
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord-api-types/v10';
import { createCommandHandlers } from '../src/index';

const env = {
  DISCORD_APPLICATION_ID: 'app-id',
  DISCORD_PUBLIC_KEY: 'public-key',
  DISCORD_TOKEN: 'token',
  DISCORD_GUILD_ID: 'guild-id',
};

describe('Command Handlers Unit', () => {
  const getRedditMedia = vi.fn(async (subreddit) => `https://reddit.com/r/${subreddit}`);
  const react = vi.fn(async (emote, env) => 42);
  const upsertCommands = vi.fn(async () => {});

  const handlers = createCommandHandlers({ getRedditMedia, react, upsertCommands });

  it('reddit handler returns media url', async () => {
    const interaction = {
      data: {
        name: 'reddit',
        type: ApplicationCommandType.ChatInput,
        options: [{ name: 'subreddit', type: ApplicationCommandOptionType.String, value: 'funny' }],
      },
    };
    const res = await handlers['reddit'](interaction, env);
    expect(getRedditMedia).toHaveBeenCalledWith('funny');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.content).toContain('reddit.com/r/funny');
  });

  it('react handler returns reaction count', async () => {
    const interaction = {
      data: {
        name: 'react',
        type: ApplicationCommandType.ChatInput,
        options: [{ name: 'emote', type: ApplicationCommandOptionType.String, value: 'smile' }],
      },
    };
    const res = await handlers['react'](interaction, env);
    expect(react).toHaveBeenCalledWith('smile', env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.content).toContain('Reacted smile');
  });

  it('invite handler returns invite url', async () => {
    const interaction = { data: { name: 'invite' } };
    const res = await handlers['invite'](interaction, env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.content).toContain('discord.com/oauth2/authorize');
    expect(json.data.flags).toBe(64);
  });

  it('refresh handler returns refreshed message', async () => {
    const interaction = { data: { name: 'refresh' } };
    const res = await handlers['refresh'](interaction, env);
    expect(upsertCommands).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.content).toContain('commands refreshed');
  });

  it('reddit handler returns 400 for missing option', async () => {
    const interaction = {
      data: {
        name: 'reddit',
        type: ApplicationCommandType.ChatInput,
        options: [],
      },
    };
    const res = await handlers['reddit'](interaction, env);
    expect(res.status).toBe(400);
  });

  it('react handler returns 400 for missing option', async () => {
    const interaction = {
      data: {
        name: 'react',
        type: ApplicationCommandType.ChatInput,
        options: [],
      },
    };
    const res = await handlers['react'](interaction, env);
    expect(res.status).toBe(400);
  });
});
