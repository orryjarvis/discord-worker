import { z } from 'zod';
import { verifyDiscordRequest, jsonResponse, editOriginalInteractionResponse } from './discord.js';
import {
  ApplicationCommandOptionType,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  TextInputStyle,
} from 'discord-api-types/v10';
import {
  commands,
  executeFollowUpTask,
  parseCommandModalSubmit,
} from './command.js';
import { dispatchRequest } from './dispatch.js';
import type {
  AppRequest,
  CommandRequest,
  DispatchOutcome,
  FollowUpTask,
  PingRequest,
  ShowModalResult,
} from './core.js';

interface FollowUpMessage {
  token: string;
  task?: FollowUpTask;
}

interface Env {
  AI: Ai;
  DISCORD_APPLICATION_ID: string;
  SIGNATURE_PUBLIC_KEY: string;
  DISCORD_TOKEN: string;
  FOLLOW_UP_QUEUE: Queue<FollowUpMessage>;
  KV: KVNamespace;
  DISCORD_API_BASE_URL?: string;
  TEST_FOLLOWUPS?: KVNamespace;
}

type RawInteraction = {
  id?: string;
  type: number;
  token?: string;
  guild_id?: string;
  channel_id?: string;
  member?: {
    user?: {
      id?: string;
    };
  };
  user?: {
    id?: string;
  };
  data?: {
    name?: string;
    options?: Array<{
      name?: string;
      type?: number;
      value?: string | number | boolean;
    }>;
    custom_id?: string;
    components?: Array<{
      components?: Array<{
        custom_id?: string;
        value?: string;
      }>;
    }>;
  };
};

const PATCH_SINK_RE = /^\/__test\/discord\/api\/v10\/webhooks\/([^/]+)\/([^/]+)\/messages\/@original$/;
const GET_FOLLOWUP_RE = /^\/__test\/followups\/([^/]+)$/;
const GET_SUBMISSION_RE = /^\/__test\/submissions\/([^/]+)$/;

const BaseInteractionSchema = z.object({
  type: z.number(),
}).passthrough();

const PingInteractionSchema = BaseInteractionSchema.extend({
  type: z.literal(InteractionType.Ping),
});

const ApplicationCommandInteractionSchema = BaseInteractionSchema.extend({
  type: z.literal(InteractionType.ApplicationCommand),
  id: z.string(),
  token: z.string(),
  data: z.object({
    name: z.string(),
    options: z.array(z.object({
      name: z.string(),
      type: z.number(),
      value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    })).optional(),
  }),
});

const MessageComponentInteractionSchema = BaseInteractionSchema.extend({
  type: z.literal(InteractionType.MessageComponent),
  id: z.string(),
  data: z.object({
    custom_id: z.string(),
  }),
});

const ModalSubmitInteractionSchema = BaseInteractionSchema.extend({
  type: z.literal(InteractionType.ModalSubmit),
  id: z.string(),
  token: z.string(),
  guild_id: z.string().optional(),
  channel_id: z.string().optional(),
  member: z.object({
    user: z.object({
      id: z.string().optional(),
    }).optional(),
  }).optional(),
  user: z.object({
    id: z.string().optional(),
  }).optional(),
  data: z.object({
    custom_id: z.string(),
    components: z.array(z.object({
      components: z.array(z.object({
        custom_id: z.string(),
        value: z.string(),
      })).optional(),
    })).optional(),
  }),
});

function extractSlashCommandOptions(
  options: Array<{
    name: string;
    type: number;
    value?: string | number | boolean;
  }> | undefined,
): Record<string, string> {
  if (!options) {
    return {};
  }

  const extracted: Record<string, string> = {};

  for (const option of options) {
    if (typeof option.value !== 'string') {
      continue;
    }

    if (option.type === ApplicationCommandOptionType.User) {
      extracted[option.name] = option.value;
      continue;
    }

    extracted[option.name] = option.value;
  }

  return extracted;
}

function parseAppRequest(raw: RawInteraction): AppRequest | Response {
  const typeResult = z.object({ type: z.number() }).safeParse(raw);
  if (!typeResult.success) {
    return new Response('Bad request.', { status: 400 });
  }

  switch (typeResult.data.type) {
    case InteractionType.Ping: {
      const parsed = PingInteractionSchema.safeParse(raw);
      if (!parsed.success) {
        return new Response('Bad request.', { status: 400 });
      }

      const request: PingRequest = { kind: 'ping' };
      return request;
    }

    case InteractionType.ApplicationCommand: {
      const parsed = ApplicationCommandInteractionSchema.safeParse(raw);
      if (!parsed.success) {
        return new Response('Bad request.', { status: 400 });
      }

      const request: CommandRequest = {
        kind: 'command',
        commandName: parsed.data.data.name.toLowerCase(),
        token: parsed.data.token,
        options: extractSlashCommandOptions(parsed.data.data.options),
      };
      return request;
    }

    case InteractionType.MessageComponent: {
      const parsed = MessageComponentInteractionSchema.safeParse(raw);
      if (!parsed.success) {
        return new Response('Bad request.', { status: 400 });
      }

      return new Response('Unknown Component', { status: 400 });
    }

    case InteractionType.ModalSubmit: {
      const parsed = ModalSubmitInteractionSchema.safeParse(raw);
      if (!parsed.success) {
        return new Response('Bad request.', { status: 400 });
      }

      const modalResult = parseCommandModalSubmit({
        customId: parsed.data.data.custom_id,
        components: parsed.data.data.components,
      });

      if (modalResult.kind === 'unknown-modal') {
        return new Response('Unknown Modal', { status: 400 });
      }

      if (modalResult.kind === 'missing-text') {
        return new Response('Missing Modal Text', { status: 400 });
      }

      const request: CommandRequest = {
        kind: 'modal-submit',
        commandName: modalResult.commandName,
        token: parsed.data.token,
        interactionId: parsed.data.id,
        userId: parsed.data.member?.user?.id ?? parsed.data.user?.id ?? null,
        guildId: parsed.data.guild_id ?? null,
        channelId: parsed.data.channel_id ?? null,
        text: modalResult.text,
      };
      return request;
    }

    default:
      return new Response('Unknown Interaction Type', { status: 400 });
  }
}

function toModalResponse(result: ShowModalResult): Response {
  return jsonResponse({
    type: InteractionResponseType.Modal,
    data: {
      custom_id: result.modalId,
      title: result.title,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: result.inputId,
              label: result.inputLabel,
              style: TextInputStyle.Paragraph,
              min_length: result.inputMinLength,
              max_length: result.inputMaxLength,
              required: result.inputRequired,
              placeholder: result.inputPlaceholder,
            },
          ],
        },
      ],
    },
  });
}

async function applyOutcome(outcome: DispatchOutcome, env: Env): Promise<Response> {
  switch (outcome.kind) {
    case 'pong':
      return jsonResponse({ type: InteractionResponseType.Pong });

    case 'defer-follow-up':
      await env.FOLLOW_UP_QUEUE.send({ token: outcome.token });
      return jsonResponse({ type: InteractionResponseType.DeferredChannelMessageWithSource });

    case 'show-modal':
      return toModalResponse(outcome);

    case 'enqueue-follow-up':
      await env.FOLLOW_UP_QUEUE.send({ token: outcome.token, task: outcome.task });
      return jsonResponse({ type: InteractionResponseType.DeferredChannelMessageWithSource });

    case 'save-submission':
      await env.KV.put(outcome.submission.interactionId, JSON.stringify(outcome.submission));
      return jsonResponse({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: outcome.content,
          flags: outcome.ephemeral ? MessageFlags.Ephemeral : 0,
        },
      });

    case 'unknown-command':
      return new Response('Unknown Command', { status: 400 });
  }
}

async function handleTestSink(request: Request, env: Env, pathname: string): Promise<Response> {
  const patchMatch = PATCH_SINK_RE.exec(pathname);
  if (request.method === 'PATCH' && patchMatch && env.TEST_FOLLOWUPS) {
    const applicationId = patchMatch[1];
    const interactionToken = patchMatch[2];
    const correlationMatch = /^test-token-(.+)$/.exec(interactionToken);
    if (!correlationMatch) {
      return new Response('Bad Request', { status: 400 });
    }
    const correlationId = correlationMatch[1];
    const body = await request.text();
    const entry = JSON.stringify({
      method: request.method,
      path: pathname,
      body,
      receivedAt: new Date().toISOString(),
      applicationId,
      interactionToken,
    });
    await env.TEST_FOLLOWUPS.put(`followup:${correlationId}`, entry, { expirationTtl: 300 });
    return jsonResponse({});
  }

  const getMatch = GET_FOLLOWUP_RE.exec(pathname);
  if (request.method === 'GET' && getMatch && env.TEST_FOLLOWUPS) {
    const correlationId = getMatch[1];
    const entry = await env.TEST_FOLLOWUPS.get(`followup:${correlationId}`);
    if (!entry) {
      return new Response('Not Found', { status: 404 });
    }
    await env.TEST_FOLLOWUPS.delete(`followup:${correlationId}`);
    return jsonResponse(JSON.parse(entry) as unknown);
  }

  if (request.method === 'DELETE' && getMatch && env.TEST_FOLLOWUPS) {
    const correlationId = getMatch[1];
    await env.TEST_FOLLOWUPS.delete(`followup:${correlationId}`);
    return new Response(null, { status: 204 });
  }

  const submissionMatch = GET_SUBMISSION_RE.exec(pathname);
  if (request.method === 'GET' && submissionMatch && env.TEST_FOLLOWUPS) {
    const interactionId = submissionMatch[1];
    const entry = await env.KV.get(interactionId);
    if (!entry) {
      return new Response('Not Found', { status: 404 });
    }
    try {
      return jsonResponse(JSON.parse(entry) as unknown);
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  }

  if (request.method === 'DELETE' && submissionMatch && env.TEST_FOLLOWUPS) {
    const interactionId = submissionMatch[1];
    await env.KV.delete(interactionId);
    return new Response(null, { status: 204 });
  }

  return new Response('Not Found', { status: 404 });
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/__test/')) {
      return handleTestSink(request, env, url.pathname);
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    if (!signature || !timestamp) {
      return new Response('Bad request signature.', { status: 401 });
    }

    const rawBody = await request.text();
    const isValid = await verifyDiscordRequest(signature, timestamp, rawBody, env.SIGNATURE_PUBLIC_KEY);
    if (!isValid) {
      return new Response('Bad request signature.', { status: 401 });
    }

    let rawInteraction: unknown;
    try {
      rawInteraction = JSON.parse(rawBody) as RawInteraction;
    } catch {
      return new Response('Bad request.', { status: 400 });
    }

    const requestOrResponse = parseAppRequest(rawInteraction as RawInteraction);
    if (requestOrResponse instanceof Response) {
      return requestOrResponse;
    }

    const outcome = await dispatchRequest(requestOrResponse, commands);
    return applyOutcome(outcome, env);
  },

  async queue(batch: MessageBatch<FollowUpMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const content = message.body.task
          ? await executeFollowUpTask(message.body.task, { AI: env.AI }, {
            messageId: message.id,
            token: message.body.token,
          })
          : 'Could not process follow-up payload. Please try again.';

        const apiBaseUrl = env.DISCORD_API_BASE_URL ?? 'https://discord.com/api/v10';
        const response = await editOriginalInteractionResponse(
          env.DISCORD_APPLICATION_ID,
          message.body.token,
          env.DISCORD_TOKEN,
          {
            content,
          },
          apiBaseUrl,
        );

        if (!response.ok) {
          throw new Error(`Failed to edit original interaction response: ${response.status} ${response.statusText}`);
        }

        message.ack();
      } catch (error) {
        console.error('Follow-up queue message processing failed', {
          messageId: message.id,
          error: describeError(error),
        });
        message.retry();
      }
    }
  },
};
