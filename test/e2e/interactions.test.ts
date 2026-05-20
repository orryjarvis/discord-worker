import { describe, it, expect } from 'vitest';
import {
  InteractionResponseType,
  InteractionType,
} from 'discord-api-types/v10';
import { signAndSendRequest, waitForFollowUp } from './signAndSendRequest';

describe('Discord Worker', () => {
  it('responds to Discord Ping interaction', async () => {
    const body = { type: InteractionType.Ping };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(InteractionResponseType.Pong);
  });

  it('responds to /pastify command with modal response (type 9)', async () => {
    const body = {
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token: `test-token-${Date.now()}`,
      data: { name: 'pastify' },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect(await res.json() as any).toMatchObject({
      type: InteractionResponseType.Modal,
      data: {
        custom_id: 'pastify_modal',
      },
    });
  });

  it('defers on modal submit and then sends channel-visible pastified content', async () => {
    const correlationId = `followup-${Date.now()}`;
    const token = `test-token-${correlationId}`;

    const submitRes = await signAndSendRequest({
      id: `modal-${Date.now()}`,
      type: InteractionType.ModalSubmit,
      token,
      guild_id: 'guild-e2e',
      channel_id: 'channel-e2e',
      member: {
        user: { id: 'user-e2e' },
      },
      data: {
        custom_id: 'pastify_modal',
        components: [
          {
            components: [
              {
                custom_id: 'pastify_modal_text',
                value: 'jungler forgets smite',
              },
            ],
          },
        ],
      },
    });

    expect(submitRes.status).toBe(200);
    expect((await submitRes.json() as any).type).toBe(InteractionResponseType.DeferredChannelMessageWithSource);

    const followUp = await waitForFollowUp(correlationId);
    const patched = JSON.parse(followUp.body) as Record<string, unknown>;
    expect(typeof patched.content).toBe('string');
    expect((patched.content as string).length).toBeGreaterThan(0);
  });

  it('responds to unknown command with 400', async () => {
    const body = {
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token: 'e2e-test-token',
      data: { name: 'notacommand' },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toMatch(/Unknown Command/);
  });
});

