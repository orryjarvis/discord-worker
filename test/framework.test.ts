import { describe, expect, it } from 'vitest';
import { etc, keygenAsync, signAsync } from '@noble/ed25519';
import { runCliApp, runDiscordApp } from '../src/apps/shared/createApp.js';

function createKvNamespace(): KVNamespace {
  const store = new Map<string, string>();

  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return { keys: [] } as never;
    },
    async getWithMetadata() {
      return { value: null, metadata: null } as never;
    },
    async putWithMetadata() {
      return undefined as never;
    },
  } as unknown as KVNamespace;
}

describe('framework bootstrap', () => {
  it('runs the reddit trending command in the CLI app', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  title: 'Example trending thread',
                  subreddit: 'javascript',
                  author: 'example_author',
                  score: 1234,
                  num_comments: 55,
                  url: 'https://www.reddit.com/r/javascript/comments/example',
                  permalink: '/r/javascript/comments/example',
                },
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );

    const output = await runCliApp({
      argv: ['reddit', 'trending', 'javascript'],
      fetchImpl,
    });

    expect(output).toContain('r/javascript trending thread');
    expect(output).toContain('Example trending thread');
    expect(output).toContain('u/example_author');
  });

  it('handles a signed Discord interaction and renders a response', async () => {
    const { secretKey, publicKey } = await keygenAsync();
    const body = JSON.stringify({
      type: 2,
      id: 'interaction-1',
      data: {
        name: 'reddit',
        options: [
          {
            type: 1,
            name: 'trending',
            options: [{ name: 'subreddit', value: 'typescript' }],
          },
        ],
      },
    });
    const timestamp = '1715550000';
    const message = new TextEncoder().encode(timestamp + body);
    const signature = await signAsync(message, secretKey);

    const request = new Request('https://example.com/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-Timestamp': timestamp,
        'X-Signature-Ed25519': etc.bytesToHex(signature),
      },
      body,
    });

    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  title: 'Example trending thread',
                  subreddit: 'typescript',
                  author: 'example_author',
                  score: 42,
                  num_comments: 10,
                  url: 'https://www.reddit.com/r/typescript/comments/example',
                  permalink: '/r/typescript/comments/example',
                },
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );

    const response = await runDiscordApp({
      request,
      fetchImpl,
      env: {
        DISCORD_APPLICATION_ID: 'application-id',
        DISCORD_TOKEN: 'bot-token',
        SIGNATURE_PUBLIC_KEY: etc.bytesToHex(publicKey),
        KV: createKvNamespace(),
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { type: number; data?: { content?: string } };
    expect(payload.type).toBe(4);
    expect(payload.data?.content).toContain('r/typescript trending thread');
  });
});
