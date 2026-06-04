import * as ed from '@noble/ed25519';
import { z } from 'zod';
import {
  ApplicationCommandType,
  ComponentType,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  TextInputStyle,
} from 'discord-api-types/v10';
import {
  commands,
  parseCommandModalSubmit,
  REMINDER_COMMAND_NAME,
} from '@/commands';
import type {
  DurableObjectNamespace,
  KVNamespace,
  Queue,
} from '@cloudflare/workers-types';
import type {
  CommandResult,
  CommandRequest,
  DispatchOutcome,
  FollowUpTask,
  PingRequest,
  ShowModalResult,
} from '@/core';
import { dispatchRequest } from '@/core';
import { scheduleReminderTaskWithAlarm } from '@/commands/reminder';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json;charset=UTF-8' },
  });
}

interface FollowUpMessage {
  token?: string;
  task?: FollowUpTask;
}

export interface DiscordInteractionHandlerEnv {
  SIGNATURE_PUBLIC_KEY: string;
  FOLLOW_UP_QUEUE: Queue<FollowUpMessage>;
  REMINDER_SCHEDULER: DurableObjectNamespace;
  KV: KVNamespace;
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
    type?: number;
    target_id?: string;
    resolved?: {
      messages?: Record<string, {
        content?: string;
        author?: {
          id?: string;
        };
      }>;
    };
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
    name: z.string(),
    type: z.number().optional(),
    target_id: z.string().optional(),
    options: z.array(z.object({
      name: z.string(),
      type: z.number(),
      value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    })).optional(),
    resolved: z.object({
      messages: z.record(z.string(), z.object({
        content: z.string().optional(),
        author: z.object({
          id: z.string().optional(),
        }).optional(),
      })).optional(),
    }).optional(),
  }),
});

type ParsedApplicationCommandData = z.infer<typeof ApplicationCommandInteractionSchema>['data'];

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
): Record<string, string | number | boolean> {
  if (!options) {
    return {};
  }

  const extracted: Record<string, string | number | boolean> = {};

  for (const option of options) {
    if (typeof option.value === 'undefined') {
      continue;
    }

    extracted[option.name] = option.value;
  }

  return extracted;
}

function extractTargetMessageContext(data: ParsedApplicationCommandData): {
  targetMessageContent: string | null;
  targetMessageAuthorId: string | null;
} {
  if (!data.target_id) {
    return {
      targetMessageContent: null,
      targetMessageAuthorId: null,
    };
  }

  const targetMessage = data.resolved?.messages?.[data.target_id];
  if (!targetMessage) {
    return {
      targetMessageContent: null,
      targetMessageAuthorId: null,
    };
  }

  return {
    targetMessageContent: targetMessage.content?.trim() || null,
    targetMessageAuthorId: targetMessage.author?.id ?? null,
  };
}

type SupportedInteractionType =
  | InteractionType.Ping
  | InteractionType.ApplicationCommand
  | InteractionType.MessageComponent
  | InteractionType.ModalSubmit;

const SUPPORTED_INTERACTION_TYPES = new Set<SupportedInteractionType>([
  InteractionType.Ping,
  InteractionType.ApplicationCommand,
  InteractionType.MessageComponent,
  InteractionType.ModalSubmit,
]);

function coerceSupportedInteractionType(value: number): SupportedInteractionType | null {
  const interactionType = value;
  if (SUPPORTED_INTERACTION_TYPES.has(interactionType)) {
    return interactionType;
  }

  return null;
}

function parseAppRequest(raw: RawInteraction): PingRequest | CommandRequest | Response {
  const typeResult = z.object({ type: z.number() }).safeParse(raw);
  if (!typeResult.success) {
    return new Response('Bad request.', { status: 400 });
  }

  const interactionType = coerceSupportedInteractionType(typeResult.data.type);
  if (!interactionType) {
    return new Response('Unknown Interaction Type', { status: 400 });
  }

  switch (interactionType) {
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

      const options = extractSlashCommandOptions(parsed.data.data.options);
      const isUserContextCommand = parsed.data.data.type === ApplicationCommandType.User;
      const isMessageContextCommand = parsed.data.data.type === ApplicationCommandType.Message;
      const isTargetContextCommand = isUserContextCommand || isMessageContextCommand;
      if (isTargetContextCommand && !parsed.data.data.target_id) {
        return new Response('Bad request.', { status: 400 });
      }

      const messageContext = isMessageContextCommand
        ? extractTargetMessageContext(parsed.data.data)
        : {
          targetMessageContent: null,
          targetMessageAuthorId: null,
        };

      const request: CommandRequest = {
        kind: 'command',
        commandName: parsed.data.data.name.toLowerCase(),
        token: parsed.data.token,
        options,
        userId: parsed.data.member?.user?.id ?? parsed.data.user?.id ?? null,
        channelId: parsed.data.channel_id ?? null,
        targetId: isTargetContextCommand
          ? parsed.data.data.target_id ?? null
          : options.target ?? null,
        targetMessageContent: messageContext.targetMessageContent,
        targetMessageAuthorId: messageContext.targetMessageAuthorId,
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

      if (modalResult.kind === 'missing-fields') {
        return new Response('Missing required modal fields.', { status: 400 });
      }

      if (modalResult.kind !== 'parsed') {
        return new Response('Bad request.', { status: 400 });
      }

      const request: CommandRequest = {
        kind: 'modal-submit',
        commandName: modalResult.commandName,
        token: parsed.data.token,
        interactionId: parsed.data.id,
        userId: parsed.data.member?.user?.id ?? parsed.data.user?.id ?? null,
        guildId: parsed.data.guild_id ?? null,
        channelId: parsed.data.channel_id ?? null,
        fields: modalResult.fields,
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
      components: result.inputs.map((input) => ({
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.TextInput,
            custom_id: input.inputId,
            label: input.inputLabel,
            style: input.inputStyle === 'short' ? TextInputStyle.Short : TextInputStyle.Paragraph,
            min_length: input.inputMinLength,
            max_length: input.inputMaxLength,
            required: input.inputRequired,
            placeholder: input.inputPlaceholder,
          },
        ],
      })),
    },
  });
}

async function applyOutcome(
  outcome: DispatchOutcome<CommandResult>,
  env: DiscordInteractionHandlerEnv,
): Promise<Response> {
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
      return jsonResponse({
        type: InteractionResponseType.DeferredChannelMessageWithSource,
        ...(outcome.ephemeral ? { data: { flags: MessageFlags.Ephemeral } } : {}),
      });

    case 'ack-and-enqueue-task':
      if (typeof outcome.delaySeconds === 'number') {
        await env.FOLLOW_UP_QUEUE.send(
          { task: outcome.task },
          { delaySeconds: outcome.delaySeconds },
        );
      } else {
        await env.FOLLOW_UP_QUEUE.send({ task: outcome.task });
      }
      return jsonResponse({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: outcome.content,
          flags: outcome.ephemeral ? MessageFlags.Ephemeral : 0,
        },
      });

    case 'ack-and-schedule-task':
      if (outcome.task.commandName !== REMINDER_COMMAND_NAME) {
        throw new Error(`Unsupported scheduled task command: ${outcome.task.commandName}`);
      }

      await scheduleReminderTaskWithAlarm(outcome.task, outcome.delaySeconds, env);
      return jsonResponse({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: outcome.content,
          flags: outcome.ephemeral ? MessageFlags.Ephemeral : 0,
        },
      });

    case 'save-submission':
      await env.KV.put(outcome.submission.interactionId, JSON.stringify(outcome.submission));
      return jsonResponse({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: outcome.content,
          flags: outcome.ephemeral ? MessageFlags.Ephemeral : 0,
        },
      });

    case 'channel-message':
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

async function verifyDiscordRequest(
  signature: string,
  timestamp: string,
  body: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const message = new TextEncoder().encode(timestamp + body);
    return await ed.verifyAsync(
      ed.etc.hexToBytes(signature),
      message,
      ed.etc.hexToBytes(publicKey),
    );
  } catch {
    return false;
  }
}

export async function handleDiscordInteractionRequest(
  request: Request,
  env: DiscordInteractionHandlerEnv,
): Promise<Response> {
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
}
