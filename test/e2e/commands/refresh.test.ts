import { describe, it, expect } from 'vitest';
import { signAndSendRequest } from '../setup';

describe('refresh command', () => {

  it('responds with 200', async () => {
    const body = {
      type: 2,
      data: { name: 'refresh' },
    };
    const res = await signAndSendRequest(body);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect((json as any).data.content).toMatch(/commands refreshed/);
  });
});
