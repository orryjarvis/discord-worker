import { describe, it, expect } from 'vitest';
import { signAndSendRequest } from '../signAndSendRequest';
import { waitForFollowup, getFollowupEvents } from '../setup.e2e';

describe('counter command', () => {
  it('responds quickly for valid hero (deferred)', async () => {
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
    const json = await res.json() as any;
    expect(json.type).toBe(5); // DeferredChannelMessageWithSource
    expect(json.data.content).toMatch(/Crunching counters for phantom lancer/i);

  await waitForFollowup((events) => events.some((e: any) => e.kind === 'editOriginalResponse' && typeof e.data?.content === 'string'));
  const events = await getFollowupEvents();
  const edit = events.find((e: any) => e.kind === 'editOriginalResponse');
  expect(edit).toBeTruthy();
  expect(edit.data).toEqual(expect.objectContaining({ content: expect.stringMatching(/Top counters for \*\*phantom lancer\*\*|No counters found|Error fetching/i) }));
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

  it('responds quickly for unknown hero (deferred)', async () => {
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
    const json = await res.json() as any;
    expect(json.type).toBe(5);
    expect(json.data.content).toMatch(/Crunching counters/i);

    await waitForFollowup((events) => events.some((e: any) => e.kind === 'editOriginalResponse' && typeof e.data?.content === 'string'));
    const events = await getFollowupEvents();
    const edit = events.find((e: any) => e.kind === 'editOriginalResponse');
    expect(edit).toBeTruthy();
    expect(edit.data).toEqual(expect.objectContaining({ content: expect.stringMatching(/No counters found|Error fetching/i) }));
  });
});
