import type {
  CommandMap,
  CommandRequest,
  CommandResult,
  FollowUpExecutionContext,
  FollowUpExecutionResult,
  FollowUpTask,
} from './core/index.js';
import type { AiRuntimeEnv } from './runtime.js';
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
} from './pastify';
import {
  ISSUE_BODY_INPUT_ID,
  ISSUE_COMMAND_NAME,
  ISSUE_MODAL_ID,
  ISSUE_TITLE_INPUT_ID,
  executeIssueFollowUp,
  parseIssueModalSubmit,
  type IssueModalParseResult,
  type IssueRuntimeEnv,
} from './issue';
import {
  parseReminderInterval,
  parseReminderLength,
  toReminderDelaySeconds,
} from './reminder';

export { PASTIFY_COMMAND_NAME, PASTIFY_MODAL_ID, PASTIFY_MODAL_TEXT_INPUT_ID } from './pastify';
export { INSULT_COMMAND_NAME } from './insult.js';
export { EIGHT_BALL_COMMAND_NAME } from './8ball.js';
export { ISSUE_COMMAND_NAME, ISSUE_MODAL_ID, ISSUE_TITLE_INPUT_ID, ISSUE_BODY_INPUT_ID } from './issue.js';

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
        inputs: [
          {
            inputId: PASTIFY_MODAL_TEXT_INPUT_ID,
            inputLabel: 'Idea to Pastify',
            inputPlaceholder: 'Describe the idea to turn into a copypasta',
            inputMinLength: 1,
            inputMaxLength: 1000,
            inputRequired: true,
            inputStyle: 'paragraph',
          },
        ],
      };

    case 'modal-submit':
      return {
        kind: 'enqueue-follow-up',
        token: request.token,
        task: {
          commandName: PASTIFY_COMMAND_NAME,
          payload: {
            idea: request.fields[PASTIFY_MODAL_TEXT_INPUT_ID],
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

function handleIssueCommand(request: CommandRequest): CommandResult {
  switch (request.kind) {
    case 'command':
      return {
        kind: 'show-modal',
        modalId: ISSUE_MODAL_ID,
        title: 'Log GitHub Issue',
        inputs: [
          {
            inputId: ISSUE_TITLE_INPUT_ID,
            inputLabel: 'Issue title',
            inputPlaceholder: 'Short summary of the bug or feature request',
            inputMinLength: 1,
            inputMaxLength: 200,
            inputRequired: true,
            inputStyle: 'short',
          },
          {
            inputId: ISSUE_BODY_INPUT_ID,
            inputLabel: 'Issue details',
            inputPlaceholder: 'Add any context, repro steps, or desired behavior',
            inputMinLength: 1,
            inputMaxLength: 4000,
            inputRequired: true,
            inputStyle: 'paragraph',
          },
        ],
      };

    case 'modal-submit':
      return {
        kind: 'enqueue-follow-up',
        token: request.token,
        task: {
          commandName: ISSUE_COMMAND_NAME,
          payload: {
            title: request.fields[ISSUE_TITLE_INPUT_ID],
            body: request.fields[ISSUE_BODY_INPUT_ID],
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

export const commands: CommandMap<CommandRequest, CommandResult> = {
  [PASTIFY_COMMAND_NAME]: handlePastifyCommand,
  [INSULT_COMMAND_NAME]: handleInsultCommand,
  [EIGHT_BALL_COMMAND_NAME]: handleEightBallCommand,
  [ISSUE_COMMAND_NAME]: handleIssueCommand,
  [WOTD_COMMAND_NAME]: handleWotdCommand,
  [REMINDER_COMMAND_NAME]: handleReminderCommand,
};

export function parseCommandModalSubmit(data: {
  customId: string;
  components?: ModalComponentRows;
}): PastifyModalParseResult | IssueModalParseResult {
  const issueResult = parseIssueModalSubmit(data);
  if (issueResult.kind !== 'unknown-modal') {
    return issueResult;
  }

  return parsePastifyModalSubmit(data);
}

export async function executeFollowUpTask(
  task: FollowUpTask,
  env: AiRuntimeEnv,
  context: FollowUpExecutionContext,
  issueEnv?: IssueRuntimeEnv,
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

  if (task.commandName === ISSUE_COMMAND_NAME) {
    if (!issueEnv) {
      throw new Error('Issue follow-up requires GitHub configuration');
    }
    return executeIssueFollowUp(task, issueEnv, context);
  }

  throw new Error(`Unknown follow-up task command: ${task.commandName}`);
}
