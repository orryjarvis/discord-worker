import type {
  AiRuntimeEnv,
  CommandMap,
  CommandRequest,
  CommandResult,
  FollowUpExecutionContext,
  FollowUpTask,
} from './core.js';
import {
  EIGHT_BALL_COMMAND_NAME,
  executeEightBallFollowUp,
} from './8ball.js';
import {
  INSULT_COMMAND_NAME,
  executeInsultFollowUp,
} from './insult.js';
import {
  PASTIFY_COMMAND_NAME,
  PASTIFY_MODAL_ID,
  PASTIFY_MODAL_TEXT_INPUT_ID,
  executePastifyFollowUp,
  parsePastifyModalSubmit,
  type PastifyModalParseResult,
} from './pastify.js';

export { PASTIFY_COMMAND_NAME, PASTIFY_MODAL_ID, PASTIFY_MODAL_TEXT_INPUT_ID } from './pastify.js';
export { INSULT_COMMAND_NAME } from './insult.js';
export { EIGHT_BALL_COMMAND_NAME } from './8ball.js';

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
        ephemeral: false,
      };

    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
}

async function handleInsultCommand(request: CommandRequest): Promise<CommandResult> {
  switch (request.kind) {
    case 'command':
      return {
        kind: 'enqueue-follow-up',
        token: request.token,
        task: {
          commandName: INSULT_COMMAND_NAME,
          payload: {
            targetUserId: request.targetId,
          },
        },
        ephemeral: request.responseVisibility === 'ephemeral',
      };

    case 'modal-submit':
    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
}

async function handleEightBallCommand(request: CommandRequest): Promise<CommandResult> {
  switch (request.kind) {
    case 'command':
      return {
        kind: 'enqueue-follow-up',
        token: request.token,
        task: {
          commandName: EIGHT_BALL_COMMAND_NAME,
          payload: {
            targetMessageId: request.targetId,
            targetMessageContent: request.targetMessageContent,
            targetMessageAuthorId: request.targetMessageAuthorId,
          },
        },
        ephemeral: request.responseVisibility === 'ephemeral',
      };

    case 'modal-submit':
    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
}

export const commands: CommandMap = {
  [PASTIFY_COMMAND_NAME]: handlePastifyCommand,
  [INSULT_COMMAND_NAME]: handleInsultCommand,
  [EIGHT_BALL_COMMAND_NAME]: handleEightBallCommand,
};

export function parseCommandModalSubmit(data: {
  customId: string;
  components?: ModalComponentRows;
}): PastifyModalParseResult {
  return parsePastifyModalSubmit(data);
}

export async function executeFollowUpTask(
  task: FollowUpTask,
  env: AiRuntimeEnv,
  context: FollowUpExecutionContext,
): Promise<string> {
  if (task.commandName === PASTIFY_COMMAND_NAME) {
    return executePastifyFollowUp(task, env, context);
  }

  if (task.commandName === INSULT_COMMAND_NAME) {
    return executeInsultFollowUp(task, env, context);
  }

  if (task.commandName === EIGHT_BALL_COMMAND_NAME) {
    return executeEightBallFollowUp(task, env, context);
  }

  throw new Error(`Unknown follow-up task command: ${task.commandName}`);
}
