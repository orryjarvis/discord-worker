import { describe, it, expect } from 'vitest';
import { signAndSendRequest } from '../signAndSendRequest';
import { waitForFollowup } from '../setup.e2e';

describe('reddit command', () => {

  it('responds quickly (deferred)', async () => {
    const body = {
      type: 2,
      data: {
        name: 'reddit',
        type: 1, // ChatInput
        options: [{ name: 'subreddit', type: 3, value: 'aww' }],
      },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.type).toBe(5); // Deferred
    expect(json.data.content).toMatch(/Fetching from r\/aww/i);

  // Prefer mirror verification for smoke compatibility
  await waitForFollowup((events) => events.some((e) => e.kind === 'editOriginalResponse' && typeof e.data?.content === 'string'));
  });
});
