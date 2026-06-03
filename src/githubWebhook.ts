import { z } from 'zod';
import type { KVNamespace } from '@cloudflare/workers-types';
import { dispatchRequest } from './core/index.js';
import {
  createGitHubCommands,
  GITHUB_WORKFLOW_RUN_COMPLETED_COMMAND,
  type GitHubWorkflowRunRequest,
} from './githubCommand.js';

const GITHUB_DELIVERY_DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 14;

const WorkflowRunEventSchema = z.object({
  action: z.string(),
  repository: z.object({
    full_name: z.string(),
  }),
  workflow_run: z.object({
    id: z.number(),
    name: z.string(),
    path: z.string().optional(),
    status: z.string().optional(),
    conclusion: z.string().nullable().optional(),
    html_url: z.string().optional(),
    head_branch: z.string().nullable().optional(),
    event: z.string().optional(),
    actor: z.object({
      login: z.string().optional(),
    }).optional(),
  }),
  sender: z.object({
    login: z.string().optional(),
  }).optional(),
}).passthrough();

export interface GitHubWebhookEnv {
  DISCORD_TOKEN: string;
  DISCORD_API_BASE_URL?: string;
  WORD_OF_DAY_CHANNEL_ID?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_DEPLOY_WORKFLOW_PATH?: string;
  KV: KVNamespace;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

async function computeHmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(new Uint8Array(signature));
}

async function isValidGitHubSignature(secret: string, rawBody: string, signatureHeader: string): Promise<boolean> {
  const signatureMatch = /^sha256=([a-fA-F0-9]{64})$/.exec(signatureHeader.trim());
  if (!signatureMatch) {
    return false;
  }

  const expected = signatureMatch[1].toLowerCase();
  const actual = await computeHmacSha256Hex(secret, rawBody);
  return timingSafeEqual(actual, expected);
}

export async function handleGitHubWebhook(request: Request, env: GitHubWebhookEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const webhookSecret = env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response('GitHub webhook secret is not configured.', { status: 500 });
  }

  const signature = request.headers.get('x-hub-signature-256');
  if (!signature) {
    return new Response('Bad request signature.', { status: 401 });
  }

  const eventType = request.headers.get('x-github-event');
  if (!eventType) {
    return new Response('Missing GitHub event header.', { status: 400 });
  }

  const deliveryId = request.headers.get('x-github-delivery');
  if (!deliveryId) {
    return new Response('Missing GitHub delivery id.', { status: 400 });
  }

  const rawBody = await request.text();
  const isValidSignature = await isValidGitHubSignature(webhookSecret, rawBody, signature);
  if (!isValidSignature) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (eventType !== 'workflow_run') {
    return new Response('GitHub event ignored.', { status: 202 });
  }

  const dedupeKey = `github-delivery:${deliveryId}`;
  const alreadyProcessed = await env.KV.get(dedupeKey);
  if (alreadyProcessed) {
    return new Response('OK', { status: 200 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return new Response('Bad request.', { status: 400 });
  }

  const parsedPayload = WorkflowRunEventSchema.safeParse(parsedJson);
  if (!parsedPayload.success) {
    return new Response('Bad request.', { status: 400 });
  }

  const payload = parsedPayload.data;
  if (payload.action !== 'completed') {
    return new Response('GitHub event ignored.', { status: 202 });
  }

  const expectedWorkflowPath = env.GITHUB_DEPLOY_WORKFLOW_PATH?.trim();
  if (expectedWorkflowPath && payload.workflow_run.path !== expectedWorkflowPath) {
    return new Response('GitHub event ignored.', { status: 202 });
  }

  const githubRequest: GitHubWorkflowRunRequest = {
    kind: 'github-command',
    commandName: GITHUB_WORKFLOW_RUN_COMPLETED_COMMAND,
    repositoryFullName: payload.repository.full_name,
    workflowRun: {
      id: payload.workflow_run.id,
      name: payload.workflow_run.name,
      path: payload.workflow_run.path ?? null,
      conclusion: payload.workflow_run.conclusion ?? null,
      htmlUrl: payload.workflow_run.html_url ?? null,
      headBranch: payload.workflow_run.head_branch ?? null,
      event: payload.workflow_run.event ?? null,
      actorLogin: payload.workflow_run.actor?.login ?? payload.sender?.login ?? null,
    },
  };

  const dispatchOutcome = await dispatchRequest(githubRequest, createGitHubCommands(env));
  if (dispatchOutcome.kind === 'unknown-command' || dispatchOutcome.kind === 'pong') {
    return new Response('GitHub event ignored.', { status: 202 });
  }

  await env.KV.put(
    dedupeKey,
    JSON.stringify({
      processedAt: new Date().toISOString(),
      runId: payload.workflow_run.id,
      workflowPath: payload.workflow_run.path ?? null,
      conclusion: payload.workflow_run.conclusion ?? null,
    }),
    { expirationTtl: GITHUB_DELIVERY_DEDUPE_TTL_SECONDS },
  );

  return new Response('OK', { status: 200 });
}
