import { describe, it, expect, vi } from 'vitest';
import { RedditCommand } from '../../src/commands/reddit';

const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  list: vi.fn(),
  getWithMetadata: vi.fn(),
  delete: vi.fn(),
};
const mockRedditService = {
  getTopPosts: vi.fn(async (subreddit: string, limit: number) => [
    { title: 'Test Post', url: 'https://reddit.com/test', author: 'user1' },
  ]),
  getMedia: vi.fn(async () => ''), // returns Promise<string>
  // Add any other required properties for RedditService interface
};
// Use mockRedditService directly for DI
const mockDeps = mockRedditService;
const mockEnv = {
  DISCORD_APPLICATION_ID: 'app-id',
  DISCORD_TOKEN: 'token',
  DISCORD_GUILD_ID: 'guild-id',
  DISCORD_PUBLIC_KEY: 'public-key',
  KV: mockKV,
};

describe('redditCommandHandler', () => {
  it('returns top posts from subreddit', async () => {
    const interaction = { data: { options: [{ name: 'subreddit', value: 'test' }] } };
    const res = await new RedditCommand(mockDeps).handle(interaction, mockEnv);
    expect(mockRedditService.getTopPosts).toHaveBeenCalledWith('test', expect.any(Number));
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.data.content).toContain('Test Post');
  });
});
