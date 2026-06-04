import type {
  CommandMap,
  CommandNamedRequest,
  DispatchOutcome,
  PingRequest,
  PongResult,
} from './index.js';

export async function dispatchRequest<TRequest extends CommandNamedRequest, TResult>(
  request: PingRequest | TRequest,
  commands: CommandMap<TRequest, TResult>,
): Promise<DispatchOutcome<TResult>> {
  if (request.kind === 'ping') {
    const pong: PongResult = { kind: 'pong' };
    return pong;
  }

  const commandRequest = request as TRequest;
  const handler = commands[commandRequest.commandName];
  if (!handler) {
    return { kind: 'unknown-command', commandName: commandRequest.commandName };
  }

  return handler(commandRequest);
}
