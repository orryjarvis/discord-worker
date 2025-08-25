import { describe, it, expect } from 'vitest';
import { signAndSendRequest } from '../setup';

describe('counter command', () => {
  it('responds with  valid hero', async () => {
    const body = {
      type: 2, // ApplicationCommand
      data: {
        name: 'counter',
        type: 1, // ChatInput
        options: [{ name: 'hero', type: 3, value: 'phantom lancer' }],
      },
    };
    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/Top counters for \*\*phantom lancer\*\*/i);
  });

  it('responds with missing hero', async () => {
    const body = {
      type: 2,
      data: {
        name: 'counter',
        type: 1,
        options: [],
      },
    };

    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).data.content).toMatch(/please specify a hero name/i);
  });

  it('responds with unknown hero', async () => {
    const body = {
      type: 2,
      data: {
        name: 'counter',
        type: 1,
        options: [{ name: 'hero', type: 3, value: 'notarealhero' }],
      },
    };

    const res = await signAndSendRequest(body);
    expect(res.status).toBe(200);
    expect((await res.json() as any).data.content).toMatch(/Error/i);
  });
});
