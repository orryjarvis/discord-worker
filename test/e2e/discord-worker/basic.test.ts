import { describe, expect, it } from 'vitest';
import { signAndSendRequest } from './signAndSendRequest';

describe('discord-worker e2e', () => {
  it('responds to ping with interaction pong', async () => {
    const response = await signAndSendRequest({
      type: 1,
      id: 'ping-test',
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { type: number };
    expect(payload.type).toBe(1);
  });

  it('returns deterministic validation error for missing subreddit', async () => {
    const response = await signAndSendRequest({
      type: 2,
      id: 'missing-subreddit-test',
      data: {
        name: 'reddit',
        options: [
          {
            type: 1,
            name: 'trending',
            options: [],
          },
        ],
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      type: number;
      data?: { content?: string };
    };

    expect(payload.type).toBe(4);
    expect(payload.data?.content).toContain('Error [missing_subreddit]');
  });
});
