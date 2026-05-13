import { afterAll, beforeAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Response } from 'undici';
import type { Unstable_DevWorker } from 'wrangler';
import { signRequest } from './setup.shared.js';

let worker: Unstable_DevWorker;

beforeAll(async () => {
  worker = await unstable_dev('src/index.ts', {
    experimental: { disableExperimentalWarning: true },
    env: 'dev',
    logLevel: 'log',
    local: false,
  });
});

afterAll(async () => {
  await worker.stop();
});

export async function signAndSendRequest(body: object): Promise<Response> {
  const request = await signRequest(body);
  return worker.fetch('/', request);
}
