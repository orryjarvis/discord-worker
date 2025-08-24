import { describe, it, expect } from 'vitest';
import { worker } from './setup';

describe('Discord Worker E2E', () => {

  it('responds to reddit command', async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      type: 2,
      data: {
        name: 'reddit',
        type: 1, // ChatInput
        options: [{ name: 'subreddit', type: 3, value: 'aww' }],
      },
    });
    const res = await worker.fetch('/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': 'dummy',
        'x-signature-timestamp': timestamp,
      },
      body,
    });
    const text = await res.text();
    if (res.status !== 200) {
      console.error('Reddit command failed:', {
        status: res.status,
        body: text,
      });
    }
    expect(res.status).toBe(200);
    expect(text).toMatch(/http/);
  });
});
