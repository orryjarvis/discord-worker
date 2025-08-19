import { describe, it, expect } from 'vitest';
import { redditService } from '../../src/services/redditService';

describe('redditService', () => {
  it('getMedia returns a valid url', async () => {
    const url = await redditService.getMedia('funny');
    expect(typeof url).toBe('string');
    expect(url.startsWith('http')).toBe(true);
  });
});
