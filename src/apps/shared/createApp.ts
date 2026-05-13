import { CommandRegistry, DefaultRouter, InMemorySessionStore, createCommandPipeline } from '@/core/index';
import { createRedditTrendingCommand } from '@/commands/reddit/trending';
import { RedditApiAdapter } from '@/integrations/reddit/redditApiAdapter';
import { CliFrontend } from '@/frontends/cli/cliFrontend';
import { CliRenderer } from '@/frontends/cli/cliRenderer';
import { DiscordFrontend, DiscordWorkerEnv } from '@/frontends/discord/discordFrontend';
import { DiscordExecutionContext } from '@/frontends/discord/discordFrontend';
import { DiscordRenderer } from '@/frontends/discord/discordRenderer';
import { KvSessionStore } from '@/runtimes/workers/kvSessionStore';
import { localRuntime } from '@/runtimes/local/localRuntime';
import { workersRuntime } from '@/runtimes/workers/workersRuntime';
import { createConsoleLogger } from '@/core/logger';

export interface CliAppDependencies {
  readonly argv: readonly string[];
  readonly fetchImpl?: typeof fetch;
}

export interface DiscordAppDependencies {
  readonly request: Request;
  readonly env: DiscordWorkerEnv & { readonly KV: KVNamespace };
  readonly fetchImpl?: typeof fetch;
  readonly ctx?: DiscordExecutionContext;
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
  const frontend = new DiscordFrontend(dependencies.env, dependencies.ctx);
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
