import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../src/index';
import { InteractionType, ApplicationCommandType, ApplicationCommandOptionType } from 'discord-api-types/v10';
import { redditService } from '../src/services/redditService';
import { reactService } from '../src/services/reactService';
import { discordService } from '../src/services/discordService';

// Mocks
vi.mock('../src/crypto', () => ({
  verifySignature: vi.fn(async () => true)
}));
vi.mock('../src/react', () => ({
  react: vi.fn(async (emote: string, env: any) => 42)
}));
vi.mock('../src/reddit', () => ({
  getRedditMedia: vi.fn(async (subreddit: string) => `https://reddit.com/r/${subreddit}`)
}));
vi.mock('../src/api', () => ({
  upsertCommands: vi.fn(async () => Promise.resolve())
}));

const env: any = {
  DISCORD_APPLICATION_ID: 'app-id',
  DISCORD_PUBLIC_KEY: 'public-key',
  DISCORD_TOKEN: 'token',
  DISCORD_GUILD_ID: 'guild-id',
  KV: {
    get: async () => '0',
    put: async () => Promise.resolve(),
  },
};

function makeRequest(method: string, body: any, headers: Record<string, string> = {}) {
  return new Request('https://worker', {
    method,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
    headers: {
      'x-signature-ed25519': 'sig',
      'x-signature-timestamp': 'ts',
      ...headers,
    },
  });
}

describe('Discord Worker Bot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => ({
      json: async () => ({
        data: {
          children: [
            { is_gallery: false, data: { url: 'https://reddit.com/r/funny' } },
            { is_gallery: false, data: { url: 'https://reddit.com/r/funny2' } },
          ]
        }
      })
    })) as any;
  });

  it('responds to Ping interaction', async () => {
    const interaction = { type: InteractionType.Ping };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.type).toBe(1); // Pong
  });

  it('handles Reddit command and invokes redditService', async () => {
    const spy = vi.spyOn(redditService, 'getMedia');
    const interaction = {
      type: InteractionType.ApplicationCommand,
      data: {
        name: 'reddit',
        type: ApplicationCommandType.ChatInput,
        options: [{ name: 'subreddit', type: ApplicationCommandOptionType.String, value: 'funny' }],
      },
    };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(spy).toHaveBeenCalledWith('funny');
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(typeof json.data.content).toBe('string');
    expect(json.data.content.startsWith('http')).toBe(true);
  });

  it('handles React command and invokes reactService', async () => {
    const spy = vi.spyOn(reactService, 'react');
    const interaction = {
      type: InteractionType.ApplicationCommand,
      data: {
        name: 'react',
        type: ApplicationCommandType.ChatInput,
        options: [{ name: 'emote', type: ApplicationCommandOptionType.String, value: 'pog' }],
      },
    };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(spy).toHaveBeenCalledWith('pog', env);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('Reacted pog');
  });

  it('handles Invite command and invokes discordService.getInviteUrl', async () => {
    const spy = vi.spyOn(discordService, 'getInviteUrl');
    const interaction = {
      type: InteractionType.ApplicationCommand,
      data: { name: 'invite' },
    };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(spy).toHaveBeenCalledWith(env.DISCORD_APPLICATION_ID);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('discord.com/oauth2/authorize');
    expect(json.data.flags).toBe(64);
  });

  it('handles Refresh command and invokes discordService.upsertCommands', async () => {
    const spy = vi.spyOn(discordService, 'upsertCommands');
    const interaction = {
      type: InteractionType.ApplicationCommand,
      data: { name: 'refresh' },
    };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(spy).toHaveBeenCalledWith(env.DISCORD_APPLICATION_ID, env.DISCORD_TOKEN, expect.anything(), env.DISCORD_GUILD_ID);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('commands refreshed');
  });

  it('returns 400 for unknown command', async () => {
    const interaction = {
      type: InteractionType.ApplicationCommand,
      data: { name: 'unknown' },
    };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown interaction type', async () => {
    const interaction = { type: 999 };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('returns 401 for invalid signature', async () => {
    // Override verifySignature to return false
    const crypto = await import('../src/crypto');
    (crypto.verifySignature as any).mockImplementation(async () => false);
    const interaction = { type: InteractionType.Ping };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(401);
    (crypto.verifySignature as any).mockImplementation(async () => true); // reset
  });

  it('returns 404 for unknown route', async () => {
    const req = new Request('https://worker/unknown', { method: 'GET' });
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(404);
  });

  it('handles Counter command and invokes DotaService', async () => {
    // Mock fetch for OpenDota API
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes('/matchups')) {
        return {
          json: async () => [
            { hero_id: 2, games_played: 100, wins: 60 }, // Axe
            { hero_id: 3, games_played: 100, wins: 55 }, // Lion
          ],
        };
      }
      // For both hero lookup and counter name mapping
      return {
        json: async () => [
          { id: 1, localized_name: 'Phantom Lancer' },
          { id: 2, localized_name: 'Axe' },
          { id: 3, localized_name: 'Lion' },
        ],
      };
    }) as any;

    const interaction = {
      type: InteractionType.ApplicationCommand,
      data: {
        name: 'counter',
        type: ApplicationCommandType.ChatInput,
        options: [{ name: 'hero', type: ApplicationCommandOptionType.String, value: 'Phantom Lancer' }],
      },
    };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.content).toMatch(/Top counters for \*\*Phantom Lancer\*\*: `Axe`, `Lion`/i);
  });
});
