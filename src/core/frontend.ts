import { CommandEnvelope } from './envelope.js';
import { Responder } from './responder.js';

export interface FrontendAdapter<TRawEvent, TTransport, TCompletion = TTransport> {
  readonly name: string;
  readonly capabilities: CommandEnvelope<TRawEvent>['capabilities'];
  normalize(rawEvent: TRawEvent): Promise<CommandEnvelope<TRawEvent> | null>;
  admit?(envelope: CommandEnvelope<TRawEvent>): Promise<{ readonly allowed: true } | { readonly allowed: false; readonly reason: string }>;
  createResponder(envelope: CommandEnvelope<TRawEvent>): Responder<TTransport, TCompletion>;
}
