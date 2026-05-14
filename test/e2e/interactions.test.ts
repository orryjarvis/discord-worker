import { describe, it, expect } from 'vitest';
import { signAndSendRequest, waitForFollowUp } from './signAndSendRequest';

describe('Discord Worker', () => {
  it('responds to Discord Ping interaction', async () => {
    const body = { type: 1 }; // InteractionType.Ping
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(1); // InteractionResponseType.Pong
  });

  it('responds to /test command with deferred response (type 5)', async () => {
    const correlationId = `setup-${Date.now()}`;
    const body = {
      type: 2, // InteractionType.ApplicationCommand
      token: `test-token-${correlationId}`,
      data: { name: 'test' },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(5);
  });

  it('queue consumer sends follow-up edit after /test', async () => {
    const correlationId = `followup-${Date.now()}`;
    const token = `test-token-${correlationId}`;

    const res = await signAndSendRequest({ type: 2, token, data: { name: 'test' } });
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(5);

    const followUp = await waitForFollowUp(correlationId);
    expect(JSON.parse(followUp.body)).toEqual({ content: 'Hello World' });
  });

  it('responds to unknown command with 400', async () => {
    const body = {
      type: 2, // InteractionType.ApplicationCommand
      token: 'e2e-test-token',
      data: { name: 'notacommand' },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toMatch(/Unknown Command/);
  });
});

