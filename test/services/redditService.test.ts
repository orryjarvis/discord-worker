import "reflect-metadata";
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

  let service: RedditService;
  beforeEach(() => {
    service = new RedditService();
  });
  it('should fetch media url', async () => {
    const url = await service.getMedia('funny');
    expect(typeof url).toBe('string');
    expect(url.startsWith('http')).toBe(true);
  });
});
