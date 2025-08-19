import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// Helper to generate a valid Discord interaction signature (mocked for local)
function mockSignature(body: string, timestamp: string) {
  // In production, Discord signs with ed25519; for local, bypass or mock
  // Here, just return a dummy string for testing
  return crypto.createHash('sha256').update(body + timestamp).digest('hex');
}

describe('Discord Worker E2E', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:8787';

  it('responds to GET / with app ID', async () => {
    const res = await fetch(baseUrl + '/');
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toMatch(/👋/);
  });

  it('responds to Discord Ping interaction', async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({ type: 1 }); // InteractionType.Ping
    const signature = mockSignature(body, timestamp);
    const res = await fetch(baseUrl + '/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      },
      body,
    });
    const json = await res.json() as { type: number };
    expect(res.status).toBe(200);
    expect(json.type).toBe(1); // InteractionResponseType.Pong
  });

  it('responds to unknown command with 400', async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      type: 2, // InteractionType.ApplicationCommand
      data: { name: 'notacommand' },
    });
    const signature = mockSignature(body, timestamp);
    const res = await fetch(baseUrl + '/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      },
      body,
    });
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toMatch(/Unknown Type/);
  });

  it('responds to invite command', async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      type: 2, // ApplicationCommand
      data: { name: 'invite' },
    });
    const res = await fetch(baseUrl + '/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': 'dummy',
        'x-signature-timestamp': timestamp,
      },
      body,
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect((json as any).data.content).toMatch(/https:\/\/discord.com\/oauth2/);
  });

  it('responds to react command', async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      type: 2,
      data: {
        name: 'react',
        type: 1, // ChatInput
        options: [{ name: 'emote', type: 3, value: 'pog' }],
      },
    });
    const res = await fetch(baseUrl + '/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': 'dummy',
        'x-signature-timestamp': timestamp,
      },
      body,
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect((json as any).data.content).toMatch(/Reacted pog/);
  });

  it('responds to reddit command', async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      type: 2,
      data: {
        name: 'reddit',
        type: 1, // ChatInput
        options: [{ name: 'subreddit', type: 3, value: 'aww' }],
      },
    });
    const res = await fetch(baseUrl + '/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': 'dummy',
        'x-signature-timestamp': timestamp,
      },
      body,
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect((json as any).data.content).toMatch(/http/);
  });

  it('responds to refresh command', async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      type: 2,
      data: { name: 'refresh' },
    });
    const res = await fetch(baseUrl + '/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': 'dummy',
        'x-signature-timestamp': timestamp,
      },
      body,
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect((json as any).data.content).toMatch(/commands refreshed/);
  });

  // Add more tests for real commands as needed
});
