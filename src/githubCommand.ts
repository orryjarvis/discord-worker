import type {
  CommandMap,
} from './core/index.js';
import { sendDiscordMessage, type SendDiscordMessageEnv } from './skills/sendDiscordMessage.js';

export const GITHUB_WORKFLOW_RUN_COMPLETED_COMMAND = 'github-workflow-run-completed';

export interface GitHubCommandEnv extends SendDiscordMessageEnv {
  WORD_OF_DAY_CHANNEL_ID?: string;
}

export interface GitHubWorkflowRunRequest {
  kind: 'github-command';
  commandName: string;
  repositoryFullName: string;
  workflowRun: {
    id: number;
    name: string;
    path: string | null;
    conclusion: string | null;
    htmlUrl: string | null;
    headBranch: string | null;
    event: string | null;
    actorLogin: string | null;
  };
}

export type GitHubCommandResult = {
  kind: 'github-command-handled';
};

function toStatusLabel(conclusion: string | null): string {
  switch (conclusion) {
    case 'success':
      return 'SUCCESS';
    case 'failure':
    case 'timed_out':
    case 'startup_failure':
    case 'cancelled':
      return 'FAILED';
    default:
      return 'COMPLETED';
  }
}

function buildDiscordContent(request: GitHubWorkflowRunRequest): string {
  const workflow = request.workflowRun;
  const status = toStatusLabel(workflow.conclusion);
  const branch = workflow.headBranch ?? 'unknown';
  const actor = workflow.actorLogin ?? 'unknown';
  const runUrl = workflow.htmlUrl ?? 'not available';
  const workflowPathSuffix = workflow.path ? ` (${workflow.path})` : '';

  return [
    `GitHub deploy status: ${status}`,
    `repo: ${request.repositoryFullName}`,
    `workflow: ${workflow.name}${workflowPathSuffix}`,
    `branch: ${branch}`,
    `trigger: ${workflow.event ?? 'unknown'}`,
    `actor: ${actor}`,
    `run: ${runUrl}`,
  ].join('\n');
}

async function handleWorkflowRunCompleted(
  request: GitHubWorkflowRunRequest,
  env: GitHubCommandEnv,
): Promise<GitHubCommandResult> {
  const channelId = env.WORD_OF_DAY_CHANNEL_ID;
  if (!channelId) {
    throw new Error('GitHub webhook cannot post status because channel id is missing');
  }

  await sendDiscordMessage(
    {
      channelId,
      content: buildDiscordContent(request),
      allowedMentions: {
        parse: [],
      },
      failurePrefix: 'Failed to post GitHub deployment status',
    },
    env,
  );

  return { kind: 'github-command-handled' };
}

export function createGitHubCommands(
  env: GitHubCommandEnv,
): CommandMap<GitHubWorkflowRunRequest, GitHubCommandResult> {
  return {
    [GITHUB_WORKFLOW_RUN_COMPLETED_COMMAND]: (request) => handleWorkflowRunCompleted(request, env),
  };
}
