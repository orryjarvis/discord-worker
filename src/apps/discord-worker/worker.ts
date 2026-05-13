import { runDiscordApp } from '@/apps/shared/createApp';
import { DiscordWorkerEnv } from '@/frontends/discord/discordFrontend';

export interface WorkerBindings extends DiscordWorkerEnv {
  readonly KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: WorkerBindings, ctx: ExecutionContext): Promise<Response> {
    return runDiscordApp({ request, env, ctx });
  },
};
