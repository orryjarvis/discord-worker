import { z } from 'zod';
import {
  verifyDiscordRequest,
  jsonResponse,
  editOriginalInteractionResponse,
} from './discord.js';
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
  executeFollowUpTask,
  parseCommandModalSubmit,
  REMINDER_COMMAND_NAME,
  WOTD_COMMAND_NAME,
} from './command.js';
import { dispatchRequest } from './dispatch.js';
import type {
  Ai,
  DurableObjectNamespace,
  KVNamespace,
  MessageBatch,
  Queue,
} from '@cloudflare/workers-types';
import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types';
import type {
  AppRequest,
  CommandRequest,
  DispatchOutcome,
  FollowUpExecutionResult,
  FollowUpTask,
  PingRequest,
  ShowModalResult,
} from './core.js';
import { runScheduledActivities } from './scheduled.js';
import { postWordOfDayMessage } from './wordOfDaySchedule.js';
import { scheduleReminderTaskWithAlarm } from './reminder.js';
import { handleGitHubWebhook } from './githubWebhook.js';

interface FollowUpMessage {
  token?: string;
  task?: FollowUpTask;
}

export interface Env {
  AI: Ai;
  DISCORD_APPLICATION_ID: string;
  SIGNATURE_PUBLIC_KEY: string;
  DISCORD_TOKEN: string;
  WORD_OF_DAY_CHANNEL_ID?: string;
  WORD_OF_DAY_FEED_URL?: string;
  FOLLOW_UP_QUEUE: Queue<FollowUpMessage>;
  REMINDER_SCHEDULER: DurableObjectNamespace;
  KV: KVNamespace;
  DISCORD_API_BASE_URL?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_DEPLOY_WORKFLOW_PATH?: string;
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

const QUOTED_SOURCE_MAX_LENGTH = 240;
const QUOTED_SOURCE_ELLIPSIS = '...';

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

function parseAppRequest(raw: RawInteraction): AppRequest | Response {
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

function formatQuotedSourceText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const truncationStart = QUOTED_SOURCE_MAX_LENGTH - QUOTED_SOURCE_ELLIPSIS.length;
  const truncated = normalized.length > QUOTED_SOURCE_MAX_LENGTH
    ? `${normalized.slice(0, truncationStart)}${QUOTED_SOURCE_ELLIPSIS}`
    : normalized;
  return `> ${truncated}`;
}

function buildFallbackEditedContent(result: FollowUpExecutionResult): string {
  const quotedSourceText = result.renderHints?.quotedSourceText;
  if (!quotedSourceText) {
    return result.content;
  }

  const quotedAuthor = result.renderHints?.quotedSourceAuthorId
    ? ` - <@${result.renderHints.quotedSourceAuthorId}>`
    : '';
  const fallbackPrefix = result.renderHints?.quotedFallbackPrefix
    ? `${result.renderHints.quotedFallbackPrefix} `
    : '';
  return `${formatQuotedSourceText(quotedSourceText)}${quotedAuthor}\n\n${fallbackPrefix}${result.content}`;
}

async function handleDiscordInteractionRequest(request: Request, env: Env): Promise<Response> {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname === '/discord') {
      return handleDiscordInteractionRequest(request, env);
    }

    if (requestUrl.pathname === '/github') {
      return handleGitHubWebhook(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },

  async queue(batch: MessageBatch<FollowUpMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const task = message.body.task;
        if (task?.commandName === WOTD_COMMAND_NAME) {
          await postWordOfDayMessage(env, new Date());
          message.ack();
          continue;
        }

        const token = message.body.token;
        if (!token) {
          throw new Error('Follow-up queue message missing interaction token');
        }

        const followUpResult = task
          ? await executeFollowUpTask(task, { AI: env.AI }, {
            messageId: message.id,
            token,
          })
          : {
            content: 'Could not process follow-up payload. Please try again.',
          };

        const apiBaseUrl = env.DISCORD_API_BASE_URL ?? 'https://discord.com/api/v10';

        const content = buildFallbackEditedContent(followUpResult);
        const response = await editOriginalInteractionResponse(
          env.DISCORD_APPLICATION_ID,
          token,
          env.DISCORD_TOKEN,
          {
            content,
            ...(followUpResult.renderHints?.quotedSourceText
              ? {
                allowed_mentions: {
                  parse: [],
                },
              }
              : {}),
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

  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil((async () => {
      try {
        await runScheduledActivities(controller, env);
      } catch (error) {
        console.error('Scheduled activity processing failed', {
          cron: controller.cron,
          scheduledTime: controller.scheduledTime,
          error: describeError(error),
        });
        throw error;
      }
    })());
  },
};
