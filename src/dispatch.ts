import type { AppRequest, CommandMap, DispatchOutcome } from './core.js';

export async function dispatchRequest(request: AppRequest, commands: CommandMap): Promise<DispatchOutcome> {
  if (request.kind === 'ping') {
    return { kind: 'pong' };
  }

  const handler = commands[request.commandName];
  if (!handler) {
    return { kind: 'unknown-command', commandName: request.commandName };
  }

  return handler(request);
}
