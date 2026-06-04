import type { ExecutionContext, MessageBatch } from '@cloudflare/workers-types';
import type { ScheduledController } from '@cloudflare/workers-types';
import { handleDiscordInteractionRequest, type DiscordInteractionHandlerEnv } from './handlers/discord.js';
import { handleGitHubWebhook, type GitHubWebhookEnv } from './handlers/github.js';
import {
  handleQueueBatch,
  runScheduled,
  type CloudflareHandlerEnv,
} from './handlers/cloudflare.js';
import type { FollowUpTask } from './core/index.js';

type FollowUpMessage = {
  token?: string;
  task?: FollowUpTask;
};

export interface Env extends DiscordInteractionHandlerEnv, GitHubWebhookEnv, CloudflareHandlerEnv {}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
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

  queue(batch: MessageBatch<FollowUpMessage>, env: Env): Promise<void> {
    return handleQueueBatch(batch, env);
  },

  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil((async () => {
      try {
        await runScheduled(controller, env);
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

