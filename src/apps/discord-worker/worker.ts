import { runDiscordApp } from '../shared/createApp.js';
import { DiscordWorkerEnv } from '../../frontends/discord/discordFrontend.js';

export interface WorkerBindings extends DiscordWorkerEnv {
  readonly KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: WorkerBindings): Promise<Response> {
    return runDiscordApp({ request, env });
  },
};
