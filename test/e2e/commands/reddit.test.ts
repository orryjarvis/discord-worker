import { describe, it, expect } from 'vitest';
import { signAndSendRequest } from '../signAndSendRequest';

describe('reddit command', () => {

  it('responds with link', async () => {
    const body = {
      type: 2,
      data: {
        name: 'reddit',
        type: 1, // ChatInput
        options: [{ name: 'subreddit', type: 3, value: 'aww' }],
      },
    };
    const res = await signAndSendRequest(body);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toMatch(/http/);
  });
});
