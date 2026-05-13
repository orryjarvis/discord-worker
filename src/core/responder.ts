export interface Responder<TTransport, TCompletion = TTransport> {
  ack(): Promise<void>;
  reply(message: TTransport): Promise<void>;
  followUp(message: TTransport): Promise<void>;
  finish(): Promise<TCompletion>;
}
