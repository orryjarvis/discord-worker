import { beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';
import type { Response } from 'undici';
import * as net from 'net';
import { signRequest } from './setup.shared';

let worker: Unstable_DevWorker;

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error('Could not allocate free port'));
      });
    });
    server.on('error', reject);
  });
}

beforeAll(async () => {
  const port = await getFreePort();
  worker = await unstable_dev('src/index.ts', {
    experimental: { disableExperimentalWarning: true },
    env: 'dev',
    logLevel: 'log',
    local: true,
    port,
    vars: { DISCORD_API_BASE_URL: `http://localhost:${port}/__test/discord/api/v10` },
  });
});

afterAll(async () => {
  await worker.stop();
});

export async function signAndSendRequest(body: object): Promise<Response> {
  const request = await signRequest(body);
  return await worker.fetch('/', request);
}

export async function waitForFollowUp(correlationId: string, timeoutMs = 15000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await worker.fetch(`/__test/followups/${correlationId}`);
    if (res.status === 200) {
      return res.json();
    }
    await new Promise<void>(r => setTimeout(r, 1000));
  }
  throw new Error(`No follow-up for correlationId "${correlationId}" received within ${timeoutMs}ms`);
}


