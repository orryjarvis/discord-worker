import { z } from 'zod';
import { verifyDiscordRequest, jsonResponse, editOriginalInteractionResponse } from './discord.js';
import {
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  TextInputStyle,
} from 'discord-api-types/v10';

// ---------------------------------------------------------------------------
// Env and queue types
// ---------------------------------------------------------------------------

interface FollowUpMessage {
  token: string;
}

interface Env {
  DISCORD_APPLICATION_ID: string;
  SIGNATURE_PUBLIC_KEY: string;
  DISCORD_TOKEN: string;
  FOLLOW_UP_QUEUE: Queue<FollowUpMessage>;
  KV: KVNamespace;
  DISCORD_API_BASE_URL: string;
  TEST_FOLLOWUPS?: KVNamespace;
}

// ---------------------------------------------------------------------------
// Flat application-level context types — one per dispatch path
// ---------------------------------------------------------------------------

type CommandContext = {
  interactionId: string;
  token: string;
  commandName: string;
};

type ComponentContext = {
  interactionId: string;
  token: string;
  customId: string;
};

type ModalContext = {
  interactionId: string;
  token: string;
  customId: string;
  userId: string | null;
  guildId: string | null;
  channelId: string | null;
  fields: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Zod schemas: raw Discord JSON → flat context
// ---------------------------------------------------------------------------

const CommandContextSchema = z.object({
  id: z.string(),
  token: z.string(),
  data: z.object({ name: z.string() }),
}).transform(r => ({
  interactionId: r.id,
  token: r.token,
  commandName: r.data.name.toLowerCase(),
} satisfies CommandContext));

const ComponentContextSchema = z.object({
  id: z.string(),
  token: z.string(),
  data: z.object({ custom_id: z.string() }),
}).transform(r => ({
  interactionId: r.id,
  token: r.token,
  customId: r.data.custom_id,
} satisfies ComponentContext));

const ModalContextSchema = z.object({
  id: z.string(),
  token: z.string(),
  guild_id: z.string().optional(),
  channel_id: z.string().optional(),
  member: z.object({ user: z.object({ id: z.string() }).optional() }).optional(),
  user: z.object({ id: z.string() }).optional(),
  data: z.object({
    custom_id: z.string(),
    components: z.array(z.object({
      components: z.array(z.object({
        custom_id: z.string(),
        value: z.string(),
      })).optional(),
    })).optional(),
  }),
}).transform(r => ({
  interactionId: r.id,
  token: r.token,
  customId: r.data.custom_id,
  userId: r.member?.user?.id ?? r.user?.id ?? null,
  guildId: r.guild_id ?? null,
  channelId: r.channel_id ?? null,
  fields: Object.fromEntries(
    (r.data.components ?? []).flatMap(row =>
      (row.components ?? []).map(input => [input.custom_id, input.value])
    )
  ),
} satisfies ModalContext));

// ---------------------------------------------------------------------------
// Dispatch infrastructure
// ---------------------------------------------------------------------------

interface DispatchEntry {
  schema: z.ZodTypeAny;
  handle: (ctx: unknown, env: Env) => Promise<Response>;
}

function makeEntry<T>(
  schema: z.ZodType<T>,
  handle: (ctx: T, env: Env) => Promise<Response>,
): DispatchEntry {
  return { schema, handle: (ctx, env) => handle(ctx as T, env) };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPEN_MODAL_BUTTON_ID = 'test_open_modal';
const MODAL_ID = 'test_modal';
const MODAL_TEXT_INPUT_ID = 'test_modal_text';

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handlePing(): Promise<Response> {
  return jsonResponse({ type: InteractionResponseType.Pong });
}

async function handleTestCommand(ctx: CommandContext, env: Env): Promise<Response> {
  await env.FOLLOW_UP_QUEUE.send({ token: ctx.token });
  return jsonResponse({ type: InteractionResponseType.DeferredChannelMessageWithSource });
}

const COMMAND_HANDLERS: Readonly<Record<string, (ctx: CommandContext, env: Env) => Promise<Response>>> = {
  test: handleTestCommand,
};

async function handleApplicationCommand(ctx: CommandContext, env: Env): Promise<Response> {
  const handler = COMMAND_HANDLERS[ctx.commandName];
  if (!handler) {
    return new Response('Unknown Command', { status: 400 });
  }
  return handler(ctx, env);
}

async function handleMessageComponent(ctx: ComponentContext): Promise<Response> {
  if (ctx.customId !== OPEN_MODAL_BUTTON_ID) {
    return new Response('Unknown Component', { status: 400 });
  }

  return jsonResponse({
    type: InteractionResponseType.Modal,
    data: {
      custom_id: MODAL_ID,
      title: 'Submit Text',
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: MODAL_TEXT_INPUT_ID,
              label: 'Text',
              style: TextInputStyle.Paragraph,
              min_length: 1,
              max_length: 1000,
              required: true,
              placeholder: 'Enter free-form text',
            },
          ],
        },
      ],
    },
  });
}

async function handleModalSubmit(ctx: ModalContext, env: Env): Promise<Response> {
  if (ctx.customId !== MODAL_ID) {
    return new Response('Unknown Modal', { status: 400 });
  }

  const text = ctx.fields[MODAL_TEXT_INPUT_ID];
  if (!text) {
    return new Response('Missing Modal Text', { status: 400 });
  }

  const submission = {
    interactionId: ctx.interactionId,
    userId: ctx.userId,
    guildId: ctx.guildId,
    channelId: ctx.channelId,
    customId: ctx.customId,
    text,
    submittedAt: new Date().toISOString(),
  };

  await env.KV.put(ctx.interactionId, JSON.stringify(submission));

  return jsonResponse({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: 'Submission saved.',
      flags: MessageFlags.Ephemeral,
    },
  });
}

// ---------------------------------------------------------------------------
// Interaction dispatch table
// ---------------------------------------------------------------------------

const INTERACTION_HANDLERS: Readonly<Partial<Record<InteractionType, DispatchEntry>>> = {
  [InteractionType.Ping]: makeEntry(z.unknown(), handlePing),
  [InteractionType.ApplicationCommand]: makeEntry(CommandContextSchema, handleApplicationCommand),
  [InteractionType.MessageComponent]: makeEntry(ComponentContextSchema, handleMessageComponent),
  [InteractionType.ModalSubmit]: makeEntry(ModalContextSchema, handleModalSubmit),
};

// ---------------------------------------------------------------------------
// Test sink routing
// ---------------------------------------------------------------------------

const PATCH_SINK_RE = /^\/__test\/discord\/api\/v10\/webhooks\/([^/]+)\/([^/]+)\/messages\/@original$/;
const GET_FOLLOWUP_RE = /^\/__test\/followups\/([^/]+)$/;
const GET_SUBMISSION_RE = /^\/__test\/submissions\/([^/]+)$/;

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
      rawInteraction = JSON.parse(rawBody);
    } catch {
      return new Response('Bad request.', { status: 400 });
    }

    const typeResult = z.object({ type: z.number() }).safeParse(rawInteraction);
    if (!typeResult.success) {
      return new Response('Bad request.', { status: 400 });
    }

    const entry = INTERACTION_HANDLERS[typeResult.data.type as InteractionType];
    if (!entry) {
      return new Response('Unknown Interaction Type', { status: 400 });
    }

    const ctxResult = entry.schema.safeParse(rawInteraction);
    if (!ctxResult.success) {
      return new Response('Bad request.', { status: 400 });
    }

    return entry.handle(ctxResult.data, env);
  },

  async queue(batch: MessageBatch<FollowUpMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const response = await editOriginalInteractionResponse(
        env.DISCORD_APPLICATION_ID,
        message.body.token,
        env.DISCORD_TOKEN,
        {
          content: 'Click to open the form.',
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  custom_id: OPEN_MODAL_BUTTON_ID,
                  label: 'Open form',
                  style: ButtonStyle.Primary,
                },
              ],
            },
          ],
        },
        env.DISCORD_API_BASE_URL,
      );

      if (!response.ok) {
        throw new Error(`Failed to edit original interaction response: ${response.status} ${response.statusText}`);
      }

      message.ack();
    }
  },
};
