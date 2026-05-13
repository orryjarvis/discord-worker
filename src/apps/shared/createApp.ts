import { CommandRegistry, DefaultRouter, InMemorySessionStore, createCommandPipeline } from '../../core/index.js';
import { createRedditTrendingCommand } from '../../commands/reddit/trending.js';
import { RedditApiAdapter } from '../../integrations/reddit/redditApiAdapter.js';
import { CliFrontend } from '../../frontends/cli/cliFrontend.js';
import { CliRenderer } from '../../frontends/cli/cliRenderer.js';
import { DiscordFrontend, DiscordWorkerEnv } from '../../frontends/discord/discordFrontend.js';
import { DiscordRenderer } from '../../frontends/discord/discordRenderer.js';
import { KvSessionStore } from '../../runtimes/workers/kvSessionStore.js';
import { localRuntime } from '../../runtimes/local/localRuntime.js';
import { workersRuntime } from '../../runtimes/workers/workersRuntime.js';
import { createConsoleLogger } from '../../core/logger.js';

export interface CliAppDependencies {
  readonly argv: readonly string[];
  readonly fetchImpl?: typeof fetch;
}

export interface DiscordAppDependencies {
  readonly request: Request;
  readonly env: DiscordWorkerEnv & { readonly KV: KVNamespace };
  readonly fetchImpl?: typeof fetch;
}

export async function runCliApp(dependencies: CliAppDependencies): Promise<string> {
  const logger = createConsoleLogger('cli-app');
  const frontend = new CliFrontend();
  const renderer = new CliRenderer();
  const sessionStore = new InMemorySessionStore();
  const registry = new CommandRegistry<{ readonly reddit: RedditApiAdapter }>();
  const reddit = new RedditApiAdapter({ fetchImpl: dependencies.fetchImpl });

  registry.register(createRedditTrendingCommand({ reddit }));

  const pipeline = createCommandPipeline({
    frontend,
    router: new DefaultRouter(),
    registry,
    renderer,
    sessionStore,
    logger,
    dependencies: { reddit },
    runtimeName: localRuntime.name,
    runtimeMode: localRuntime.mode,
  });

  const response = await pipeline.execute({ argv: dependencies.argv });
  return response;
}

export async function runDiscordApp(dependencies: DiscordAppDependencies): Promise<Response> {
  const logger = createConsoleLogger('discord-app');
  const frontend = new DiscordFrontend(dependencies.env);
  const renderer = new DiscordRenderer();
  const sessionStore = new KvSessionStore(dependencies.env.KV);
  const registry = new CommandRegistry<{ readonly reddit: RedditApiAdapter }>();
  const reddit = new RedditApiAdapter({ fetchImpl: dependencies.fetchImpl ?? fetch });

  registry.register(createRedditTrendingCommand({ reddit }));

  const pipeline = createCommandPipeline({
    frontend,
    router: new DefaultRouter(),
    registry,
    renderer,
    sessionStore,
    logger,
    dependencies: { reddit },
    runtimeName: workersRuntime.name,
    runtimeMode: workersRuntime.mode,
  });

  const normalized = await frontend.normalize({ request: dependencies.request, env: dependencies.env });
  if (!normalized) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (normalized.path[0] === 'discord' && normalized.path[1] === 'ping') {
    return new Response(JSON.stringify({ type: 1 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return pipeline.executeEnvelope(normalized);
}
