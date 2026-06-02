import type {
  AiRuntimeEnv,
  CommandMap,
  CommandRequest,
  CommandResult,
  FollowUpExecutionContext,
  FollowUpExecutionResult,
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
import {
  parseReminderInterval,
  parseReminderLength,
  toReminderDelaySeconds,
} from './reminder.js';

export { PASTIFY_COMMAND_NAME, PASTIFY_MODAL_ID, PASTIFY_MODAL_TEXT_INPUT_ID } from './pastify.js';
export { INSULT_COMMAND_NAME } from './insult.js';
export { EIGHT_BALL_COMMAND_NAME } from './8ball.js';

export const WOTD_COMMAND_NAME = 'wotd';
export const REMINDER_COMMAND_NAME = 'reminder';

function parseReminderNote(value: string | number | boolean | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const note = value.trim();
  if (!note) {
    return null;
  }

  return note;
}

type ModalComponentRows = Array<{
  components?: Array<{
    custom_id?: string;
    value?: string;
  }>;
}>;

function handlePastifyCommand(request: CommandRequest): CommandResult {
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

function handleInsultCommand(request: CommandRequest): CommandResult {
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
        ephemeral: false,
      };

    case 'modal-submit':
    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
}

function handleEightBallCommand(request: CommandRequest): CommandResult {
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
        ephemeral: false,
      };

    case 'modal-submit':
    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
}

function handleWotdCommand(request: CommandRequest): CommandResult {
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

function handleReminderCommand(request: CommandRequest): CommandResult {
  switch (request.kind) {
    case 'command': {
      const length = parseReminderLength(request.options.length);
      const interval = parseReminderInterval(request.options.interval);
      const note = parseReminderNote(request.options.note);
      if (!length || !interval || !note) {
        return {
          kind: 'channel-message',
          content: 'Usage: /reminder length:<number> interval:<minutes|hours|days> note:<text>',
          ephemeral: true,
        };
      }

      if (length < 1) {
        return {
          kind: 'channel-message',
          content: 'Length must be at least 1.',
          ephemeral: true,
        };
      }

      if (!request.channelId || !request.userId) {
        return {
          kind: 'channel-message',
          content: 'Could not schedule reminder from this context.',
          ephemeral: true,
        };
      }

      return {
        kind: 'ack-and-schedule-task',
        content: `Reminder set for ${length} ${interval}.`,
        task: {
          commandName: REMINDER_COMMAND_NAME,
          payload: {
            channelId: request.channelId,
            userId: request.userId,
            length,
            interval,
            note,
          },
        },
        ephemeral: true,
        delaySeconds: toReminderDelaySeconds(length, interval),
      };
    }

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
  [WOTD_COMMAND_NAME]: handleWotdCommand,
  [REMINDER_COMMAND_NAME]: handleReminderCommand,
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
): Promise<FollowUpExecutionResult> {
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
