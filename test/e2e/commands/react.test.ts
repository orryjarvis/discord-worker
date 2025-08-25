import { describe, it, expect } from 'vitest';
import { signAndSendRequest } from '../signAndSendRequest';

describe('react command', () => {
  it('response with reaction', async () => {
    const body = {
      type: 2,
      data: {
        name: 'react',
        type: 1, // ChatInput
        options: [{ name: 'emote', type: 3, value: 'pog' }],
      },
    };
    
    const res = await signAndSendRequest(body);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect((json as any).data.content).toMatch(/Reacted pog/);
  });
});
