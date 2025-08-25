import { describe, it, expect } from 'vitest';
import { signAndSendRequest } from '../setup';

describe('invite command', () => {
  it('responds with link', async () => {
    const body = {
      type: 2, // ApplicationCommand
      data: { name: 'invite' },
    };
    const res = await signAndSendRequest(body);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect((json as any).data.content).toMatch(/https:\/\/discord.com\/oauth2/);
  });
});
