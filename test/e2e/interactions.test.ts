import { describe, it, expect } from 'vitest';
import {
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from 'discord-api-types/v10';
import { signAndSendRequest, waitForFollowUp, waitForSubmission } from './signAndSendRequest';

describe('Discord Worker', () => {
  it('responds to Discord Ping interaction', async () => {
    const body = { type: InteractionType.Ping };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(InteractionResponseType.Pong);
  });

  it('responds to /test command with deferred response (type 5)', async () => {
    const correlationId = `setup-${Date.now()}`;
    const body = {
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token: `test-token-${correlationId}`,
      data: { name: 'test' },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(InteractionResponseType.DeferredChannelMessageWithSource);
  });

  it('queue consumer sends follow-up edit after /test', async () => {
    const correlationId = `followup-${Date.now()}`;
    const token = `test-token-${correlationId}`;

    const res = await signAndSendRequest({
      id: `cmd-${Date.now()}`,
      type: InteractionType.ApplicationCommand,
      token,
      data: { name: 'test' },
    });
    expect(res.status).toBe(200);
    expect((await res.json() as any).type).toBe(InteractionResponseType.DeferredChannelMessageWithSource);

    const followUp = await waitForFollowUp(correlationId);
    expect(JSON.parse(followUp.body)).toEqual({
      content: 'Click to open the form.',
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              custom_id: 'test_open_modal',
              label: 'Open form',
              style: ButtonStyle.Primary,
            },
          ],
        },
      ],
    });
  });

  it('opens modal from button interaction and stores modal submit data in KV', async () => {
    const buttonRes = await signAndSendRequest({
      id: `btn-${Date.now()}`,
      type: InteractionType.MessageComponent,
      token: 'button-token',
      data: { custom_id: 'test_open_modal' },
    });

    expect(buttonRes.status).toBe(200);
    expect(await buttonRes.json() as any).toMatchObject({
      type: InteractionResponseType.Modal,
      data: {
        custom_id: 'test_modal',
      },
    });

    const interactionId = `modal-${Date.now()}`;
    const submitRes = await signAndSendRequest({
      id: interactionId,
      type: InteractionType.ModalSubmit,
      token: 'modal-token',
      guild_id: 'guild-e2e',
      channel_id: 'channel-e2e',
      member: {
        user: { id: 'user-e2e' },
      },
      data: {
        custom_id: 'test_modal',
        components: [
          {
            components: [
              {
                custom_id: 'test_modal_text',
                value: 'stored from e2e',
              },
            ],
          },
        ],
      },
    });

    expect(submitRes.status).toBe(200);
    expect(await submitRes.json() as any).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'Submission saved.',
        flags: MessageFlags.Ephemeral,
      },
    });

    const submission = await waitForSubmission(interactionId);
    expect(submission).toMatchObject({
      interactionId,
      userId: 'user-e2e',
      guildId: 'guild-e2e',
      channelId: 'channel-e2e',
      customId: 'test_modal',
      text: 'stored from e2e',
    });
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

