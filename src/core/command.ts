import { CommandEnvelope } from './envelope';
import { CommandError, CommandResult, SessionState } from './effects';
import { Logger } from './logger';

export interface CommandContext<TInput, TRawEvent = unknown> {
  readonly envelope: CommandEnvelope<TRawEvent>;
  readonly input: TInput;
  readonly session: SessionState;
  readonly logger: Logger;
}

export interface CommandHandler<TInput, TOutput, TRawEvent = unknown> {
  execute(context: CommandContext<TInput, TRawEvent>): Promise<CommandResult<TOutput>>;
}

export interface CommandDefinition<TDependencies, TInput, TOutput, TRawEvent = unknown> {
  readonly path: readonly string[];
  readonly description: string;
  readonly usage: string;
  readonly defer?: boolean;
  parse(envelope: CommandEnvelope<TRawEvent>): TInput | null;
  createHandler(dependencies: TDependencies): CommandHandler<TInput, TOutput, TRawEvent>;
}

export function createCommandFailure(code: string, message: string, details?: unknown): CommandError {
  return {
    code,
    message,
    details,
  };
}
