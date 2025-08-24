import "reflect-metadata";
import { describe, it, expect } from 'vitest';
import { ReactService } from '../../src/services/reactService';
import { Env } from '../../src/types';

describe('reactService', () => {
  let service;
  beforeEach(() => {
    service = new ReactService();
  });
  it('react returns correct count for valid emote', async () => {
    const env: Env = {
      KV: {
        get: async () => '0',
        put: async () => Promise.resolve(), // resolves the lint error
      }
    } as any;
    const count = await service.react('pog', env); // updated to use DI
    expect(typeof count).toBe('string');
    expect(count.endsWith('st') || count.endsWith('nd') || count.endsWith('rd') || count.endsWith('th')).toBe(true);
  });
});
