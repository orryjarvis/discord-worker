import type { CommandMap, CommandRequest, CommandResult } from './core.js';

export const PASTIFY_COMMAND_NAME = 'pastify';
export const PASTIFY_MODAL_ID = 'pastify_modal';
export const PASTIFY_MODAL_TEXT_INPUT_ID = 'pastify_modal_text';

async function handlePastifyCommand(request: CommandRequest): Promise<CommandResult> {
  switch (request.kind) {
    case 'command':
      return {
        kind: 'show-modal',
        modalId: PASTIFY_MODAL_ID,
        title: 'Pastify Idea',
        inputId: PASTIFY_MODAL_TEXT_INPUT_ID,
        inputLabel: 'Idea to Pastify',
        inputPlaceholder: 'Describe the idea to turn into a copypasta',
        inputMinLength: 1,
        inputMaxLength: 1000,
        inputRequired: true,
      };

    case 'modal-submit':
      return {
        kind: 'enqueue-pastify',
        token: request.token,
        idea: request.text,
      };

    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
}

export const commands: CommandMap = {
  [PASTIFY_COMMAND_NAME]: handlePastifyCommand,
};
