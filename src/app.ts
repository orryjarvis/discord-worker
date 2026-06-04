import { editOriginalInteractionResponse } from './integrations/discord.js';
import {
  executeFollowUpTask,
  WOTD_COMMAND_NAME,
} from './commands/index.js';
import type {
  Ai,
  DurableObjectNamespace,
  KVNamespace,
  MessageBatch,
  Queue,
} from '@cloudflare/workers-types';
import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types';
import type {
  FollowUpExecutionResult,
  FollowUpTask,
} from './core/index.js';
import { runScheduledActivities } from './scheduled.js';
import { postWordOfDayMessage } from './commands/wordOfDaySchedule.js';
import { handleGitHubWebhook } from './handlers/github.js';
import { handleDiscordInteractionRequest, type DiscordInteractionHandlerEnv } from './handlers/discord.js';

interface FollowUpMessage {
  token?: string;
  task?: FollowUpTask;
}

export interface Env extends DiscordInteractionHandlerEnv {
  AI: Ai;
  DISCORD_APPLICATION_ID: string;
  DISCORD_TOKEN: string;
  WORD_OF_DAY_CHANNEL_ID?: string;
  WORD_OF_DAY_FEED_URL?: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_INSTALLATION_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_ISSUE_REPOSITORY: string;
  GITHUB_API_BASE_URL?: string;
  FOLLOW_UP_QUEUE: Queue<FollowUpMessage>;
  REMINDER_SCHEDULER: DurableObjectNamespace;
  KV: KVNamespace;
  DISCORD_API_BASE_URL?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_DEPLOY_WORKFLOW_PATH?: string;
}
const QUOTED_SOURCE_MAX_LENGTH = 240;
const QUOTED_SOURCE_ELLIPSIS = '...';

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
          }, env)
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
