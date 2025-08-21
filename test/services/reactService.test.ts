import { describe, it, expect } from 'vitest';
import { reactService } from '../../src/services/reactService';
import { Env } from '../../src/types';

describe('reactService', () => {
  it('react returns correct count for valid emote', async () => {
    const env: Env = {
      KV: {
        get: async () => '0',
        put: async () => Promise.resolve(), // resolves the lint error
      }
    } as any;
    const count = await reactService.react('pog', env);
    expect(typeof count).toBe('string');
    expect(count.endsWith('st') || count.endsWith('nd') || count.endsWith('rd') || count.endsWith('th')).toBe(true);
  });
});
