import { CommandContext } from './command';
import { CommandEnvelope } from './envelope';
import { CommandRegistry } from './registry';
import { Router } from './router';
import { Renderer, RenderContext } from './renderer';
import { FrontendAdapter } from './frontend';
import { Logger } from './logger';
import { SessionState } from './effects';
import { SessionStore, createEmptySession } from './session';

export interface CommandPipelineDependencies<TDependencies, TRawEvent, TTransport, TCompletion> {
  readonly frontend: FrontendAdapter<TRawEvent, TTransport, TCompletion>;
  readonly router: Router<TDependencies>;
  readonly registry: CommandRegistry<TDependencies>;
  readonly renderer: Renderer<unknown, TTransport, TRawEvent>;
  readonly sessionStore: SessionStore;
  readonly logger: Logger;
  readonly dependencies: TDependencies;
  readonly runtimeName: string;
  readonly runtimeMode: string;
}

export function createCommandPipeline<TDependencies, TRawEvent, TTransport, TCompletion>(
  config: CommandPipelineDependencies<TDependencies, TRawEvent, TTransport, TCompletion>,
) {
  const { frontend, router, registry, renderer, sessionStore, logger, dependencies, runtimeName, runtimeMode } = config;

  function applyEffects(effects: readonly import('./effects').CommandEffect[] | undefined, session: SessionState): SessionState {
    if (!effects || effects.length === 0) {
      return session;
    }

    let nextSession = session;
    for (const effect of effects) {
      if (effect.type === 'log') {
        logger[effect.level](effect.message, effect.metadata);
      }
      if (effect.type === 'session') {
        nextSession = effect.session;
      }
    }

    return nextSession;
  }

  async function applySessionEnvelope(envelope: CommandEnvelope<TRawEvent>): Promise<SessionState> {
    const existingSession = await sessionStore.load(envelope.sessionKey);
    if (existingSession) {
      return existingSession;
    }

    const session = createEmptySession(envelope.sessionKey);
    await sessionStore.save(envelope.sessionKey, session);
    return session;
  }

  async function executeEnvelope(envelope: CommandEnvelope<TRawEvent>): Promise<TCompletion> {
    const responder = frontend.createResponder(envelope);

    if (frontend.admit) {
      const admission = await frontend.admit(envelope);
      if (!admission.allowed) {
        await responder.reply(await renderer.renderFailure({ envelope, session: createEmptySession(envelope.sessionKey), logger }, {
          ok: false,
          error: { code: 'admission_denied', message: admission.reason },
        }));
        return responder.finish();
      }
    }

    const session = await applySessionEnvelope(envelope);
    const route = router.route(envelope, registry);
    if (!route) {
      const failure = await renderer.renderFailure({ envelope, session, logger }, {
        ok: false,
        error: { code: 'command_not_found', message: `Unknown command: ${envelope.path.join(' ')}` },
      });
      await responder.reply(failure);
      return responder.finish();
    }

    const handler = route.definition.createHandler(dependencies);
    const context: CommandContext<typeof route.input, TRawEvent> = {
      envelope,
      input: route.input,
      session,
      logger,
    };

    try {
      const result = await handler.execute(context);
      if (result.defer ?? route.definition.defer ?? false) {
        await responder.ack();
      }

      const effectSession = applyEffects(result.effects, session);
      const nextSession = result.session ?? {
        ...effectSession,
        status: result.ok ? 'active' : 'failed',
        updatedAt: new Date().toISOString(),
      };
      await sessionStore.save(envelope.sessionKey, nextSession);

      const renderContext: RenderContext<TRawEvent> = { envelope, session: nextSession, logger };
      const transport = result.ok
        ? await renderer.renderSuccess(renderContext, result)
        : await renderer.renderFailure(renderContext, result);

      await responder.reply(transport);
      return responder.finish();
    } catch (error) {
      logger.error('command execution failed', { error: error instanceof Error ? error.message : String(error) });
      const failure = await renderer.renderFailure({ envelope, session, logger }, {
        ok: false,
        error: {
          code: 'command_execution_failed',
          message: error instanceof Error ? error.message : 'Unknown command failure',
          details: error,
        },
      });
      await responder.reply(failure);
      return responder.finish();
    }
  }

  async function execute(rawEvent: TRawEvent): Promise<TCompletion> {
    const envelope = await frontend.normalize(rawEvent);
    if (!envelope) {
      logger.debug('frontend ignored event', { runtimeName, runtimeMode });
      return frontend.createResponder({
        id: 'noop',
        path: [],
        args: [],
        source: { name: frontend.name, mode: 'unknown' },
        runtime: { name: runtimeName, mode: runtimeMode },
        rawEvent,
        sessionKey: 'noop',
        receivedAt: new Date().toISOString(),
        capabilities: frontend.capabilities,
        metadata: {},
      }).finish();
    }

    return executeEnvelope(envelope);
  }

  return {
    execute,
    executeEnvelope,
  };
}
