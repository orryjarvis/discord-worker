import { describe, it, expect } from 'vitest';
import { signAndSendRequest, waitForFollowUp } from './signAndSendRequest';

const isSmoke = process.env.TEST_SETUP === 'smoke';

describe('Discord Worker', () => {
  it('responds to Discord Ping interaction', async () => {
    const body = { type: 1 }; // InteractionType.Ping
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(1); // InteractionResponseType.Pong
  });

  it('responds to /test command with deferred response (type 5)', async () => {
    const body = {
      type: 2, // InteractionType.ApplicationCommand
      token: 'e2e-test-token',
      data: { name: 'test' },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(5);
  });

  it.skipIf(isSmoke)('queue consumer sends follow-up edit after /test', async () => {
    const token = 'follow-up-test-token';
    const followUp = waitForFollowUp(token);

    const res = await signAndSendRequest({ type: 2, token, data: { name: 'test' } });
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(5);

    const patch = await followUp;
    expect(patch.path).toContain(`/${token}/messages/@original`);
    expect(JSON.parse(patch.body)).toEqual({ content: 'Hello World' });
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

