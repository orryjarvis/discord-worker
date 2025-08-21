import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedditService } from '../../src/services/redditService';

describe('redditService', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      json: async () => ({
        data: {
          children: [
            { is_gallery: false, data: { url: 'https://reddit.com/r/funny' } },
            { is_gallery: false, data: { url: 'https://reddit.com/r/funny2' } },
          ]
        }
      })
    })) as any;
  });

  it('getMedia returns a valid url', async () => {
    const url = await new RedditService().getMedia('funny');
    expect(typeof url).toBe('string');
    expect(url.startsWith('http')).toBe(true);
  });
});
