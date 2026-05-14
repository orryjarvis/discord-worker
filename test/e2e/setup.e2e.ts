import { beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';
import type { Response } from 'undici';
import http from 'http';
import { signRequest } from './setup.shared';

let worker: Unstable_DevWorker;

type FollowUpRequest = { path: string; body: string };
const received = new Map<string, FollowUpRequest>();
const waiters = new Map<string, Array<(req: FollowUpRequest) => void>>();

function tokenFromPath(path: string): string | null {
  const m = path.match(/\/webhooks\/[^/]+\/([^/]+)\/messages/);
  return m ? m[1] : null;
}

const mockDiscordServer = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    if (req.method === 'PATCH') {
      const token = tokenFromPath(req.url ?? '');
      if (token) {
        const captured: FollowUpRequest = { path: req.url ?? '', body };
        received.set(token, captured);
        const resolvers = waiters.get(token) ?? [];
        waiters.delete(token);
        resolvers.forEach(r => r(captured));
      }
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
});

beforeAll(async () => {
  const port = await new Promise<number>((resolve) => {
    mockDiscordServer.listen(0, '127.0.0.1', () => {
      resolve((mockDiscordServer.address() as { port: number }).port);
    });
  });

  worker = await unstable_dev('src/index.ts', {
    experimental: { disableExperimentalWarning: true },
    env: 'dev',
    logLevel: 'log',
    local: true,
    vars: { DISCORD_API_BASE: `http://127.0.0.1:${port}` },
  });
});

afterAll(async () => {
  await worker.stop();
  await new Promise<void>((resolve) => mockDiscordServer.close(() => resolve()));
});

async function signAndSendRequest(body: object): Promise<Response> {
  const request = await signRequest(body);
  return await worker.fetch('/', request);
}

export function waitForFollowUp(token: string, timeoutMs = 10000): Promise<FollowUpRequest> {
  const existing = received.get(token);
  if (existing) {
    received.delete(token);
    return Promise.resolve(existing);
  }
  return new Promise((resolve, reject) => {
    const resolvers = waiters.get(token) ?? [];
    const timer = setTimeout(() => {
      const list = waiters.get(token);
      if (list) {
        const idx = list.indexOf(resolver);
        if (idx !== -1) list.splice(idx, 1);
      }
      reject(new Error(`No follow-up for token "${token}" received within ${timeoutMs}ms`));
    }, timeoutMs);
    const resolver = (req: FollowUpRequest) => { clearTimeout(timer); resolve(req); };
    resolvers.push(resolver);
    waiters.set(token, resolvers);
  });
}

export { signAndSendRequest };

