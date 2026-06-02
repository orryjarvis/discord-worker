import type {
  FollowUpExecutionContext,
  FollowUpExecutionResult,
  FollowUpTask,
} from './core.js';
import { extractModalFields, type ModalComponentRows } from './modal.js';

export const ISSUE_COMMAND_NAME = 'issue';
export const ISSUE_MODAL_ID = 'issue_modal';
export const ISSUE_TITLE_INPUT_ID = 'issue_title';
export const ISSUE_BODY_INPUT_ID = 'issue_body';

const GITHUB_API_VERSION = '2022-11-28';
const GITHUB_USER_AGENT = 'discord-worker (+https://github.com/orryjarvis/discord-worker)';
const GITHUB_ISSUE_FAILURE_MESSAGE = 'Could not create GitHub issue right now. Try again in a moment.';

type GitHubIssueRepository = {
  owner: string;
  repo: string;
};

export interface IssueRuntimeEnv {
  GITHUB_APP_ID: string;
  GITHUB_APP_INSTALLATION_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_ISSUE_REPOSITORY: string;
  GITHUB_API_BASE_URL?: string;
}

export type IssueModalParseResult =
  | { kind: 'unknown-modal' }
  | { kind: 'missing-fields' }
  | {
    kind: 'parsed';
    commandName: typeof ISSUE_COMMAND_NAME;
    fields: Record<string, string>;
  };

type GitHubInstallationTokenResponse = {
  token?: string;
};

type GitHubCreatedIssueResponse = {
  html_url?: string;
  number?: number;
};

function parseIssueRepository(repository: string): GitHubIssueRepository {
  const [owner, repo, ...rest] = repository.split('/').filter(Boolean);
  if (!owner || !repo || rest.length > 0) {
    throw new Error('GITHUB_ISSUE_REPOSITORY must be set to owner/repo');
  }

  return { owner, repo };
}

function toBase64Url(binary: Uint8Array): string {
  let text = '';
  for (const byte of binary) {
    text += String.fromCharCode(byte);
  }

  return btoa(text)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function encodeBase64UrlJson(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodePemToArrayBuffer(pem: string): ArrayBuffer {
  const normalizedPem = pem.replace(/\\n/g, '\n');
  const base64 = normalizedPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
    .replace(/-----END RSA PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  if (!base64) {
    throw new Error('GITHUB_APP_PRIVATE_KEY is empty or not a valid PEM value');
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const buffer = new ArrayBuffer(bytes.byteLength);
  const bufferBytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) {
    bufferBytes[index] = bytes[index];
  }
  return buffer;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

async function readResponseText(response: Response): Promise<string> {
  const text = (await response.text()).trim();
  if (!text) {
    return '';
  }

  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (typeof parsed.message === 'string') {
      return parsed.message;
    }
  } catch {
    // Fall back to raw body text.
  }

  return text.length > 200 ? `${text.slice(0, 200)}...` : text;
}

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

async function createGitHubAppJwt(env: IssueRuntimeEnv): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = encodeBase64UrlJson({
    iat: now - 60,
    exp: now + 540,
    iss: env.GITHUB_APP_ID,
  });
  const signingInput = `${header}.${payload}`;
  const keyData = decodePemToArrayBuffer(env.GITHUB_APP_PRIVATE_KEY);
  const signingInputBytes = new TextEncoder().encode(signingInput);
  const signingInputBuffer: ArrayBuffer = new ArrayBuffer(signingInputBytes.byteLength);
  const signingInputBufferBytes = new Uint8Array(signingInputBuffer);
  for (let index = 0; index < signingInputBytes.length; index += 1) {
    signingInputBufferBytes[index] = signingInputBytes[index];
  }

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    signingInputBuffer,
  );

  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

async function createInstallationAccessToken(env: IssueRuntimeEnv, apiBaseUrl: string): Promise<string> {
  const jwt = await createGitHubAppJwt(env);
  const response = await fetch(`${apiBaseUrl}/app/installations/${env.GITHUB_APP_INSTALLATION_ID}/access_tokens`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      'User-Agent': GITHUB_USER_AGENT,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  });

  if (!response.ok) {
    const details = await readResponseText(response);
    const suffix = details ? ` (${details})` : '';
    throw new Error(`Failed to create GitHub installation token: ${response.status} ${response.statusText}${suffix}`);
  }

  const parsed = await response.json() as GitHubInstallationTokenResponse;
  if (typeof parsed.token !== 'string' || !parsed.token) {
    throw new Error('GitHub installation token response was missing a token');
  }

  return parsed.token;
}

async function createGitHubIssue(
  env: IssueRuntimeEnv,
  title: string,
  body: string,
): Promise<{ htmlUrl: string; number: number }> {
  const apiBaseUrl = env.GITHUB_API_BASE_URL ?? 'https://api.github.com';
  const repository = parseIssueRepository(env.GITHUB_ISSUE_REPOSITORY);
  const installationToken = await createInstallationAccessToken(env, apiBaseUrl);

  const response = await fetch(`${apiBaseUrl}/repos/${repository.owner}/${repository.repo}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${installationToken}`,
      'Content-Type': 'application/json',
      'User-Agent': GITHUB_USER_AGENT,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
    body: JSON.stringify({
      title,
      body,
    }),
  });

  if (!response.ok) {
    const details = await readResponseText(response);
    const suffix = details ? ` (${details})` : '';
    throw new Error(`Failed to create GitHub issue: ${response.status} ${response.statusText}${suffix}`);
  }

  const parsed = await response.json() as GitHubCreatedIssueResponse;
  if (typeof parsed.html_url !== 'string' || typeof parsed.number !== 'number') {
    throw new Error('GitHub issue response was missing the issue URL or number');
  }

  return {
    htmlUrl: parsed.html_url,
    number: parsed.number,
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

  try {
    const issue = await createGitHubIssue(env, title, body);
    return {
      content: `Created GitHub issue #${issue.number}: ${issue.htmlUrl}`,
    };
  } catch (error) {
    console.error('GitHub issue creation failed', {
      messageId: context.messageId,
      commandName: task.commandName,
      titleLength: title.length,
      bodyLength: body.length,
      error: describeError(error),
    });
    return {
      content: GITHUB_ISSUE_FAILURE_MESSAGE,
    };
  }
}