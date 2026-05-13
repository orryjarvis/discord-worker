import { CommandEnvelope } from './envelope';
import { CommandRegistry } from './registry';

export interface RouteMatch<TInput, TOutput, TDependencies, TRawEvent = unknown> {
  readonly definition: {
    readonly path: readonly string[];
    readonly description: string;
    readonly usage: string;
    readonly defer?: boolean;
    parse(envelope: CommandEnvelope<TRawEvent>): TInput | null;
    createHandler(dependencies: TDependencies): {
      execute(context: import('./command').CommandContext<TInput, TRawEvent>): Promise<import('./effects').CommandResult<TOutput>>;
    };
  };
  readonly input: TInput;
}

export interface Router<TDependencies> {
  route<TInput, TOutput, TRawEvent>(
    envelope: CommandEnvelope<TRawEvent>,
    registry: CommandRegistry<TDependencies>,
  ): RouteMatch<TInput, TOutput, TDependencies, TRawEvent> | null;
}

export class DefaultRouter implements Router<unknown> {
  route<TInput, TOutput, TRawEvent>(
    envelope: CommandEnvelope<TRawEvent>,
    registry: CommandRegistry<unknown>,
  ): RouteMatch<TInput, TOutput, unknown, TRawEvent> | null {
    const definition = registry.get(envelope.path);
    if (!definition) {
      return null;
    }

    const input = definition.parse(envelope) as TInput | null;
    if (input === null) {
      return null;
    }

    return {
      definition: definition as RouteMatch<TInput, TOutput, unknown, TRawEvent>['definition'],
      input,
    };
  }
}
