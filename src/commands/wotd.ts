import type {
  CommandRequest,
  CommandResult,
} from '@/core';

export const WOTD_COMMAND_NAME = 'wotd';

export function handleWotdCommand(request: CommandRequest): CommandResult {
  switch (request.kind) {
    case 'command':
      return {
        kind: 'ack-and-enqueue-task',
        content: 'wotd queued',
        task: {
          commandName: WOTD_COMMAND_NAME,
          payload: {},
        },
        ephemeral: false,
      };

    case 'modal-submit':
    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
}
