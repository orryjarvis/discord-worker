import { describe, it, expect } from 'vitest';
import { redditCommandHandler } from '../../src/commands/reddit';

const mockDeps = {
  redditService: {
    getMedia: async (subreddit: string) => `https://reddit.com/r/${subreddit}`,
  },
};
const mockEnv = {};

describe('redditCommandHandler', () => {
  it('returns media url for valid subreddit', async () => {
    const interaction = {
      data: {
        type: 1,
        options: [{ name: 'subreddit', type: 3, value: 'funny' }],
      },
    };
    const res = await redditCommandHandler(interaction, mockEnv, mockDeps);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('reddit.com/r/funny');
  });

  it('returns 400 for missing option', async () => {
    const interaction = { data: { type: 1, options: [] } };
    const res = await redditCommandHandler(interaction, mockEnv, mockDeps);
    expect(res.status).toBe(400);
  });
});
