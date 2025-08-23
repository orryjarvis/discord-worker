import { beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';

let worker: Unstable_DevWorker;

beforeAll(async () => {
  worker = await unstable_dev('src/index.ts', {
    experimental: { disableExperimentalWarning: true },
    env: 'dev',
    logLevel: 'log'
  });
});

afterAll(async () => {
  await worker.stop();
});

export { worker };
