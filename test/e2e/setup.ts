import { beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { Unstable_DevWorker } from 'wrangler';
import type { Response } from 'undici';
import * as ed from '@noble/ed25519';

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

async function signAndSendRequest(body: object): Promise<Response> {
  const timestamp = Date.now().toString();
  const json = JSON.stringify(body);
  const message = new TextEncoder().encode(timestamp + json);
  const privateKeyHex = process.env.DISCORD_PRIVATE_KEY || "bfbb3f0da095ff411191941cf30bc7a4afaa2a223b78ad05a049751b265f5049";
  const privateKey = Uint8Array.from(Buffer.from(privateKeyHex, "hex"));
  const signatureUint8 = await ed.signAsync(message, privateKey);
  const signatureHex = Buffer.from(signatureUint8).toString('hex');
  const res = await worker.fetch('/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': signatureHex,
      'x-signature-timestamp': timestamp,
    },
    body: JSON.stringify(body),
  });
  return res;
}

export { worker, signAndSendRequest };
