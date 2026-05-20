import type { CommandMap, CommandRequest, CommandResult } from './core.js';

export const TEST_COMMAND_NAME = 'test';
export const TEST_OPEN_MODAL_BUTTON_ID = 'test_open_modal';
export const TEST_MODAL_ID = 'test_modal';
export const TEST_MODAL_TEXT_INPUT_ID = 'test_modal_text';

async function handleTestCommand(request: CommandRequest): Promise<CommandResult> {
  switch (request.kind) {
      case 'command':
        return {
          kind: 'defer-follow-up',
          token: request.token,
        };

      case 'component':
        return {
          kind: 'show-modal',
          modalId: TEST_MODAL_ID,
          title: 'Submit Text',
          inputId: TEST_MODAL_TEXT_INPUT_ID,
          inputLabel: 'Text',
          inputPlaceholder: 'Enter free-form text',
          inputMinLength: 1,
          inputMaxLength: 1000,
          inputRequired: true,
        };

      case 'modal-submit':
        if (!request.text) {
          return { kind: 'missing-modal-text' };
        }

        return {
          kind: 'save-submission',
          submission: {
            interactionId: request.interactionId,
            userId: request.userId,
            guildId: request.guildId,
            channelId: request.channelId,
            customId: TEST_MODAL_ID,
            text: request.text,
            submittedAt: new Date().toISOString(),
          },
          content: 'Submission saved.',
          ephemeral: true,
        };

      default:
        throw new Error('Unhandled command request');
    }
}

export const commands: CommandMap = {
  [TEST_COMMAND_NAME]: handleTestCommand,
};
