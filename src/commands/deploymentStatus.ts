import type {
  CommandMap,
} from '@/core';
import { sendDiscordMessage, type SendDiscordMessageEnv } from '@/skills/sendDiscordMessage';

export const DEPLOYMENT_STATUS_COMMAND_NAME = 'github-workflow-run-completed';

export interface DeploymentStatusCommandEnv extends SendDiscordMessageEnv {
  WORD_OF_DAY_CHANNEL_ID?: string;
}

export interface DeploymentStatusRequest {
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

export type DeploymentStatusCommandResult = {
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

function buildDiscordContent(request: DeploymentStatusRequest): string {
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

async function handleDeploymentStatusCommand(
  request: DeploymentStatusRequest,
  env: DeploymentStatusCommandEnv,
): Promise<DeploymentStatusCommandResult> {
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

export function createDeploymentStatusCommands(
  env: DeploymentStatusCommandEnv,
): CommandMap<DeploymentStatusRequest, DeploymentStatusCommandResult> {
  return {
    [DEPLOYMENT_STATUS_COMMAND_NAME]: (request) => handleDeploymentStatusCommand(request, env),
  };
}