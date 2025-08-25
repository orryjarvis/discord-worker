import { describe, it, expect } from 'vitest';
import { signAndSendRequest } from './signAndSendRequest';

describe('Discord Worker E2E', () => {
  it('responds to Discord Ping interaction', async () => {
    const body = { type: 1 }; // InteractionType.Ping
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(1); // InteractionResponseType.Pong
  });

  it('responds to unknown command with 400', async () => {
    const body = {
      type: 2, // InteractionType.ApplicationCommand
      data: { name: 'notacommand' },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toMatch(/Unknown Command/);
  });
});
