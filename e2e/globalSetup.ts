/**
 * Runs in Node context (once per test session) via Vitest's globalSetup.
 * Starts the mock Discord API + RSS feed server and provides its base URL
 * to the Workers-context tests via the inject mechanism.
 */
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  interface ProvidedContext {
    mockServerBaseUrl: string;
  }
}
import { Buffer } from 'node:buffer';
import * as http from 'node:http';
import * as net from 'node:net';

type CapturedDiscordRequest = {
  method: string;
  path: string;
  body: string;
  receivedAt: string;
  applicationId?: string;
  interactionToken?: string;
  channelId?: string;
};

type CapturedGitHubIssueRequest = {
  method: string;
  path: string;
  body: string;
  receivedAt: string;
};

const followUpsByCorrelationId = new Map<string, CapturedDiscordRequest[]>();
const channelPostsByChannelId = new Map<string, CapturedDiscordRequest[]>();
const githubIssuesByRepoSlug = new Map<string, CapturedGitHubIssueRequest[]>();

const WEBHOOK_PATH_RE = /^\/api\/v10\/webhooks\/([^/]+)\/([^/]+)(?:\/messages\/@original)?$/;
const CHANNEL_MESSAGE_PATH_RE = /^\/api\/v10\/channels\/([^/]+)\/messages$/;
const GITHUB_INSTALLATION_TOKEN_PATH_RE = /^\/api\/github\/app\/installations\/([^/]+)\/access_tokens$/;
const GITHUB_ISSUE_PATH_RE = /^\/api\/github\/repos\/([^/]+)\/([^/]+)\/issues$/;

const MOCK_WORD_OF_DAY_FEED_PATH = '/mock/wotd/feed/rss2';
const MOCK_WORD_OF_DAY_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:merriam="https://www.merriam-webster.com/word-of-the-day" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">
  <channel>
    <item>
      <title><![CDATA[ benevolent ]]></title>
      <link><![CDATA[ https://www.merriam-webster.com/word-of-the-day/benevolent-2026-05-22 ]]></link>
      <description><![CDATA[<p><strong>benevolent</strong> &#149; \\buh-NEV-uh-lunt\\ &#149; <em>adjective</em></p>]]></description>
      <itunes:summary><![CDATA[ Merriam-Webster's Word of the Day for May 22, 2026 is: benevolent \\buh-NEV-uh-lunt\\ adjective ]]></itunes:summary>
      <merriam:shortdef><![CDATA[ marked by or disposed to doing good ]]></merriam:shortdef>
    </item>
  </channel>
</rss>`;

function enqueueFollowUp(correlationId: string, entry: CapturedDiscordRequest): void {
  const entries = followUpsByCorrelationId.get(correlationId) ?? [];
  entries.push(entry);
  followUpsByCorrelationId.set(correlationId, entries);
}

function enqueueChannelPost(channelId: string, entry: CapturedDiscordRequest): void {
  const entries = channelPostsByChannelId.get(channelId) ?? [];
  entries.push(entry);
  channelPostsByChannelId.set(channelId, entries);
}

function enqueueGitHubIssue(repoSlug: string, entry: CapturedGitHubIssueRequest): void {
  const entries = githubIssuesByRepoSlug.get(repoSlug) ?? [];
  entries.push(entry);
  githubIssuesByRepoSlug.set(repoSlug, entries);
}

function dequeueFollowUp(correlationId: string): CapturedDiscordRequest | null {
  const entries = followUpsByCorrelationId.get(correlationId);
  if (!entries || entries.length === 0) return null;
  const entry = entries.shift() ?? null;
  if (entries.length === 0) followUpsByCorrelationId.delete(correlationId);
  return entry;
}

function dequeueChannelPost(channelId: string): CapturedDiscordRequest | null {
  const entries = channelPostsByChannelId.get(channelId);
  if (!entries || entries.length === 0) return null;
  const entry = entries.shift() ?? null;
  if (entries.length === 0) channelPostsByChannelId.delete(channelId);
  return entry;
}

function dequeueGitHubIssue(repoSlug: string): CapturedGitHubIssueRequest | null {
  const entries = githubIssuesByRepoSlug.get(repoSlug);
  if (!entries || entries.length === 0) return null;
  const entry = entries.shift() ?? null;
  if (entries.length === 0) githubIssuesByRepoSlug.delete(repoSlug);
  return entry;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : null;
      srv.close(() => (port ? resolve(port) : reject(new Error('No port'))));
    });
    srv.on('error', reject);
  });
}

function startMockServer(port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    void (async () => {
      const method = req.method ?? 'GET';
      const urlPath = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;

      // ── Control API ──────────────────────────────────────────────────────────
      if (method === 'GET' && urlPath.startsWith('/test-api/follow-ups/')) {
        const id = urlPath.slice('/test-api/follow-ups/'.length);
        const entry = dequeueFollowUp(id);
        if (entry) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(entry));
        } else {
          res.writeHead(204);
          res.end();
        }
        return;
      }

      if (method === 'GET' && urlPath.startsWith('/test-api/channel-posts/')) {
        const id = urlPath.slice('/test-api/channel-posts/'.length);
        const entry = dequeueChannelPost(id);
        if (entry) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(entry));
        } else {
          res.writeHead(204);
          res.end();
        }
        return;
      }

      if (method === 'DELETE' && urlPath.startsWith('/test-api/channel-posts/')) {
        const id = urlPath.slice('/test-api/channel-posts/'.length);
        channelPostsByChannelId.delete(id);
        res.writeHead(204);
        res.end();
        return;
      }

      if (method === 'GET' && urlPath.startsWith('/test-api/github-issues/')) {
        const repoSlug = urlPath.slice('/test-api/github-issues/'.length);
        const entry = dequeueGitHubIssue(repoSlug);
        if (entry) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(entry));
        } else {
          res.writeHead(204);
          res.end();
        }
        return;
      }

      // ── RSS feed mock ─────────────────────────────────────────────────────────
      if (method === 'GET' && urlPath === MOCK_WORD_OF_DAY_FEED_PATH) {
        res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' });
        res.end(MOCK_WORD_OF_DAY_FEED_XML);
        return;
      }

      // ── Discord API mocks (need body for capture) ─────────────────────────────
      const body = await readBody(req);
      const entry: CapturedDiscordRequest = {
        method,
        path: urlPath,
        body,
        receivedAt: new Date().toISOString(),
      };

      const webhookMatch = WEBHOOK_PATH_RE.exec(urlPath);
      if (webhookMatch) {
        const interactionToken = webhookMatch[2];
        const correlationMatch = /^test-token-(.+)$/.exec(interactionToken);
        if (correlationMatch) {
          entry.applicationId = webhookMatch[1];
          entry.interactionToken = interactionToken;
          enqueueFollowUp(correlationMatch[1], entry);
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
        return;
      }

      const githubTokenMatch = GITHUB_INSTALLATION_TOKEN_PATH_RE.exec(urlPath);
      if (githubTokenMatch) {
        const userAgentHeader = req.headers['user-agent'];
        const hasUserAgent = typeof userAgentHeader === 'string' && userAgentHeader.trim().length > 0;
        if (!hasUserAgent) {
          res.writeHead(403, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Request forbidden by administrative rules. Please make sure your request has a User-Agent header.',
          }));
          return;
        }

        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          token: 'github-installation-token-e2e',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }));
        return;
      }

      const githubIssueMatch = GITHUB_ISSUE_PATH_RE.exec(urlPath);
      if (githubIssueMatch) {
        const userAgentHeader = req.headers['user-agent'];
        const hasUserAgent = typeof userAgentHeader === 'string' && userAgentHeader.trim().length > 0;
        if (!hasUserAgent) {
          res.writeHead(403, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            message: 'Request forbidden by administrative rules. Please make sure your request has a User-Agent header.',
          }));
          return;
        }

        const repoSlug = `${githubIssueMatch[1]}/${githubIssueMatch[2]}`;
        enqueueGitHubIssue(repoSlug, {
          method,
          path: urlPath,
          body,
          receivedAt: new Date().toISOString(),
        });

        let parsedBody: { title?: string } = {};
        try {
          parsedBody = JSON.parse(body) as { title?: string };
        } catch {
          // Ignore parsing errors and fall back to a generic response.
        }

        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          html_url: `https://github.com/${repoSlug}/issues/42`,
          number: 42,
          title: parsedBody.title ?? 'unknown',
          body,
        }));
        return;
      }

      const channelMatch = CHANNEL_MESSAGE_PATH_RE.exec(urlPath);
      if (channelMatch) {
        entry.channelId = channelMatch[1];
        enqueueChannelPost(channelMatch[1], entry);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    })().catch(() => {
      res.writeHead(500);
      res.end('Internal Server Error');
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

let mockServer: http.Server;

export async function setup(project: TestProject): Promise<void> {
  followUpsByCorrelationId.clear();
  channelPostsByChannelId.clear();
  const port = await getFreePort();
  mockServer = await startMockServer(port);
  project.provide('mockServerBaseUrl', `http://127.0.0.1:${port}`);
}

export async function teardown(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    mockServer.close((err) => (err ? reject(err) : resolve()));
  });
}
