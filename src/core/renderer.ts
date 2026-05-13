import { CommandFailure, CommandSuccess, SessionState } from './effects.js';
import { CommandEnvelope } from './envelope.js';
import { Logger } from './logger.js';

export interface RenderContext<TRawEvent = unknown> {
  readonly envelope: CommandEnvelope<TRawEvent>;
  readonly session: SessionState;
  readonly logger: Logger;
}

export interface Renderer<TData, TTransport, TRawEvent = unknown> {
  renderSuccess(context: RenderContext<TRawEvent>, result: CommandSuccess<TData>): Promise<TTransport>;
  renderFailure(context: RenderContext<TRawEvent>, result: CommandFailure): Promise<TTransport>;
}
