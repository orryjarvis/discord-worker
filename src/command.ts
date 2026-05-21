import type { CommandMap, CommandRequest, CommandResult, FollowUpTask } from './core.js';
import {
  PASTIFY_COMMAND_NAME,
  PASTIFY_MODAL_ID,
  PASTIFY_MODAL_TEXT_INPUT_ID,
  executePastifyFollowUp,
  parsePastifyModalSubmit,
  type FollowUpExecutionContext,
  type PastifyRuntimeEnv,
  type PastifyModalParseResult,
} from './pastify.js';

export { PASTIFY_COMMAND_NAME, PASTIFY_MODAL_ID, PASTIFY_MODAL_TEXT_INPUT_ID } from './pastify.js';

type ModalComponentRows = Array<{
  components?: Array<{
    custom_id?: string;
    value?: string;
  }>;
}>;

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
        kind: 'enqueue-follow-up',
        token: request.token,
        task: {
          commandName: PASTIFY_COMMAND_NAME,
          payload: {
            idea: request.text,
          },
        },
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

export function parseCommandModalSubmit(data: {
  customId: string;
  components?: ModalComponentRows;
}): PastifyModalParseResult {
  return parsePastifyModalSubmit(data);
}

export async function executeFollowUpTask(
  task: FollowUpTask,
  env: PastifyRuntimeEnv,
  context: FollowUpExecutionContext,
): Promise<string> {
  if (task.commandName !== PASTIFY_COMMAND_NAME) {
    throw new Error(`Unknown follow-up task command: ${task.commandName}`);
  }

  return executePastifyFollowUp(task, env, context);
}
