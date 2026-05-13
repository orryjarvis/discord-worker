import { CommandFailure, CommandSuccess, SessionState } from './effects';
import { CommandEnvelope } from './envelope';
import { Logger } from './logger';

export interface RenderContext<TRawEvent = unknown> {
  readonly envelope: CommandEnvelope<TRawEvent>;
  readonly session: SessionState;
  readonly logger: Logger;
}

export interface Renderer<TData, TTransport, TRawEvent = unknown> {
  renderSuccess(context: RenderContext<TRawEvent>, result: CommandSuccess<TData>): Promise<TTransport>;
  renderFailure(context: RenderContext<TRawEvent>, result: CommandFailure): Promise<TTransport>;
}
