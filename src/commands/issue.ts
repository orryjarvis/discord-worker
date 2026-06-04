import type {
  FollowUpExecutionContext,
  FollowUpExecutionResult,
  FollowUpTask,
} from '../core/index.js';
import { createIssue, type IssueSkillEnv } from '../skills/issue.js';
import { extractModalFields, type ModalComponentRows } from '../skills/modalFields.js';

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
