import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import { RedditCommand } from '../../src/commands/reddit.js';
import { RedditService } from '../../src/services/redditService.js';
import { container } from 'tsyringe';

describe('RedditCommand', () => {
  it('handles validated input and returns output', async () => {
    const svc = { getMedia: async (_: string) => 'https://example.com/x' } as unknown as RedditService;
    container.registerInstance(RedditService, svc);
    const cmd = new RedditCommand(svc);
  const res = await (cmd as any).handle({ subreddit: 'pics' } as any);
    expect(res).toEqual({ url: 'https://example.com/x' });
  });
});
