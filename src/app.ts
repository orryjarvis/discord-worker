import { z } from 'zod';
import { verifyDiscordRequest, jsonResponse, editOriginalInteractionResponse } from './discord.js';
import {
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  TextInputStyle,
} from 'discord-api-types/v10';
import {
  commands,
  PASTIFY_COMMAND_NAME,
  PASTIFY_MODAL_ID,
  PASTIFY_MODAL_TEXT_INPUT_ID,
} from './command.js';
import { dispatchRequest } from './dispatch.js';
import type {
  AppRequest,
  CommandRequest,
  DispatchOutcome,
  PingRequest,
  ShowModalResult,
} from './core.js';

interface FollowUpMessage {
  token: string;
  idea?: string;
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
    custom_id?: string;
    components?: Array<{
      components?: Array<{
        custom_id?: string;
        value?: string;
      }>;
    }>;
  };
};

type ModalComponentRows = Array<{
  components?: Array<{
    custom_id?: string;
    value?: string;
  }>;
}>;

const PATCH_SINK_RE = /^\/__test\/discord\/api\/v10\/webhooks\/([^/]+)\/([^/]+)\/messages\/@original$/;
const GET_FOLLOWUP_RE = /^\/__test\/followups\/([^/]+)$/;
const GET_SUBMISSION_RE = /^\/__test\/submissions\/([^/]+)$/;
const PASTIFY_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';

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

function flattenModalText(components: ModalComponentRows | undefined): string | null {
  if (!components) {
    return null;
  }

  for (const row of components) {
    const inputs = row.components;
    if (!inputs) {
      continue;
    }

    for (const input of inputs) {
      if (input.custom_id === PASTIFY_MODAL_TEXT_INPUT_ID && typeof input.value === 'string') {
        return input.value;
      }
    }
  }

  return null;
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

      if (parsed.data.data.custom_id !== PASTIFY_MODAL_ID) {
        return new Response('Unknown Modal', { status: 400 });
      }

      const text = flattenModalText(parsed.data.data.components);
      if (!text) {
        return new Response('Missing Modal Text', { status: 400 });
      }

      const request: CommandRequest = {
        kind: 'modal-submit',
        commandName: PASTIFY_COMMAND_NAME,
        token: parsed.data.token,
        interactionId: parsed.data.id,
        userId: parsed.data.member?.user?.id ?? parsed.data.user?.id ?? null,
        guildId: parsed.data.guild_id ?? null,
        channelId: parsed.data.channel_id ?? null,
        text,
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

    case 'enqueue-pastify':
      await env.FOLLOW_UP_QUEUE.send({ token: outcome.token, idea: outcome.idea });
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

function extractAiText(result: unknown): string | null {
  if (typeof result === 'string') {
    return result.trim() || null;
  }

  if (!result || typeof result !== 'object') {
    return null;
  }

  const obj = result as Record<string, unknown>;
  const directText = obj.response ?? obj.text ?? obj.output_text;
  if (typeof directText === 'string' && directText.trim()) {
    return directText.trim();
  }

  const nested = obj.result;
  if (nested && typeof nested === 'object') {
    const nestedObj = nested as Record<string, unknown>;
    const nestedText = nestedObj.response ?? nestedObj.text ?? nestedObj.output_text;
    if (typeof nestedText === 'string' && nestedText.trim()) {
      return nestedText.trim();
    }
  }

  return null;
}

async function generatePastifiedText(idea: string, env: Env): Promise<string> {
  const promptMessages = [
    {
      role: 'system',
      content:
        'You are a Twitch chat copypasta writer. Turn the idea into one energetic, funny, copy/paste-ready message. Keep it to 2-5 lines, avoid slurs/harassment, and output only the final copypasta text.',
    },
    {
      role: 'user',
      content: `Idea: ${idea}`,
    },
  ];

  const rawResult = await env.AI.run(PASTIFY_MODEL, {
    messages: promptMessages,
    max_tokens: 220,
    temperature: 0.9,
  });

  const output = extractAiText(rawResult);
  if (!output) {
    throw new Error('Workers AI returned no text output');
  }

  return output;
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
      let content: string;
      const idea = message.body.idea?.trim();
      if (!idea) {
        content = 'Could not process follow-up payload. Please try again.';
      } else {
        try {
          content = await generatePastifiedText(idea, env);
        } catch (error) {
          console.error('Pastify generation failed', {
            messageId: message.id,
            token: message.body.token,
            error,
          });
          content = 'Could not pastify that idea right now. Try again in a moment.';
        }
      }

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
    }
  },
};
