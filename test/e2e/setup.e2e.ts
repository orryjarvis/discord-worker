import { beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';
import type { Response } from 'undici';
import { signRequest } from './setup.shared';

let worker: Unstable_DevWorker;

beforeAll(async () => {
  worker = await unstable_dev('src/index.ts', {
    experimental: { disableExperimentalWarning: true },
    env: 'dev',
    logLevel: 'log',
    local: false
  });
});

afterAll(async () => {
  await worker.stop();
});

async function signAndSendRequest(body: object): Promise<Response> {
  const request = await signRequest(body);
  return await worker.fetch('/', request);
}

export { signAndSendRequest };
