import type {
  CommandRequest,
  CommandResult,
  FollowUpExecutionContext,
  FollowUpExecutionResult,
  FollowUpTask,
} from '@/core';
import { createIssue, type IssueSkillEnv } from '@/skills/issue';
import { extractModalFields, type ModalComponentRows } from '@/skills/modalFields';

export const ISSUE_COMMAND_NAME = 'issue';
export const ISSUE_MODAL_ID = 'issue_modal';
export const ISSUE_TITLE_INPUT_ID = 'issue_title';
export const ISSUE_BODY_INPUT_ID = 'issue_body';

const GITHUB_ISSUE_FAILURE_MESSAGE = 'Could not create GitHub issue right now. Try again in a moment.';
export type IssueRuntimeEnv = IssueSkillEnv;

export type IssueModalParseResult =
  | { kind: 'unknown-modal' }
  | { kind: 'missing-fields' }
  | {
    kind: 'parsed';
    commandName: typeof ISSUE_COMMAND_NAME;
    fields: Record<string, string>;
  };

export function parseIssueModalSubmit(data: {
  customId: string;
  components?: ModalComponentRows;
}): IssueModalParseResult {
  if (data.customId !== ISSUE_MODAL_ID) {
    return { kind: 'unknown-modal' };
  }

  const fields = extractModalFields(data.components);
  const title = fields[ISSUE_TITLE_INPUT_ID]?.trim();
  const body = fields[ISSUE_BODY_INPUT_ID]?.trim();
  if (!title || !body) {
    return { kind: 'missing-fields' };
  }

  return {
    kind: 'parsed',
    commandName: ISSUE_COMMAND_NAME,
    fields: {
      [ISSUE_TITLE_INPUT_ID]: title,
      [ISSUE_BODY_INPUT_ID]: body,
    },
  };
}

export function handleIssueCommand(request: CommandRequest): CommandResult {
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

export async function executeIssueFollowUp(
  task: FollowUpTask,
  env: IssueRuntimeEnv,
  context: FollowUpExecutionContext,
): Promise<FollowUpExecutionResult> {
  const title = typeof task.payload.title === 'string' ? task.payload.title.trim() : '';
  const body = typeof task.payload.body === 'string' ? task.payload.body.trim() : '';
  if (!title || !body) {
    console.warn('Issue follow-up payload missing title or body', {
      messageId: context.messageId,
      commandName: task.commandName,
    });
    return {
      content: GITHUB_ISSUE_FAILURE_MESSAGE,
    };
  }

  return createIssue(env, title, body, { messageId: context.messageId, commandName: task.commandName });
}
