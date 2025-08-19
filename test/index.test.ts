import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../src/index';
import { InteractionType, ApplicationCommandType, ApplicationCommandOptionType } from 'discord-api-types/v10';

// Mocks
vi.mock('../src/crypto', () => ({
  verifySignature: vi.fn(() => true)
}));
vi.mock('../src/react', () => ({
  react: vi.fn(async (emote, env) => 42)
}));
vi.mock('../src/reddit', () => ({
  getRedditMedia: vi.fn(async (subreddit) => `https://reddit.com/r/${subreddit}`)
}));
vi.mock('../src/api', () => ({
  upsertCommands: vi.fn(async () => {})
}));

const env = {
  DISCORD_APPLICATION_ID: 'app-id',
  DISCORD_PUBLIC_KEY: 'public-key',
  DISCORD_TOKEN: 'token',
  DISCORD_GUILD_ID: 'guild-id',
};

function makeRequest(method, body, headers = {}) {
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
  it('responds to Ping interaction', async () => {
    const interaction = { type: InteractionType.Ping };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe(1); // Pong
  });

  it('handles Reddit command', async () => {
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
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.content).toContain('reddit.com/r/funny');
  });

  it('handles React command', async () => {
    const interaction = {
      type: InteractionType.ApplicationCommand,
      data: {
        name: 'react',
        type: ApplicationCommandType.ChatInput,
        options: [{ name: 'emote', type: ApplicationCommandOptionType.String, value: 'smile' }],
      },
    };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.content).toContain('Reacted smile');
  });

  it('handles Invite command', async () => {
    const interaction = {
      type: InteractionType.ApplicationCommand,
      data: { name: 'invite' },
    };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.content).toContain('discord.com/oauth2/authorize');
    expect(json.data.flags).toBe(64);
  });

  it('handles Refresh command', async () => {
    const interaction = {
      type: InteractionType.ApplicationCommand,
      data: { name: 'refresh' },
    };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json();
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
    crypto.verifySignature.mockResolvedValue(false);
    const interaction = { type: InteractionType.Ping };
    const req = makeRequest('POST', interaction);
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(401);
    crypto.verifySignature.mockResolvedValue(true); // reset
  });

  it('returns 404 for unknown route', async () => {
    const req = new Request('https://worker/unknown', { method: 'GET' });
    const res = await handler.fetch(req, env);
    expect(res.status).toBe(404);
  });
});
