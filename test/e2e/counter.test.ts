import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { worker } from './setup';

function mockSignature(body: string, timestamp: string) {
  return crypto.createHash('sha256').update(body + timestamp).digest('hex');
}

describe('/counter command E2E', () => {
  it('responds to counter command with valid hero', async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      type: 2, // ApplicationCommand
      data: {
        name: 'counter',
        type: 1, // ChatInput
        options: [{ name: 'hero', type: 3, value: 'phantom lancer' }],
      },
    });
    const signature = mockSignature(body, timestamp);
    const res = await worker.fetch('/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      },
      body,
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect((json as any).data.content).toMatch(/Top counters for \*\*phantom lancer\*\*/i);
  });

  it('responds to counter command with missing hero', async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      type: 2,
      data: {
        name: 'counter',
        type: 1,
        options: [],
      },
    });
    const signature = mockSignature(body, timestamp);
    const res = await worker.fetch('/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      },
      body,
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect((json as any).data.content).toMatch(/please specify a hero name/i);
  });

  it('responds to counter command with unknown hero', async () => {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({
      type: 2,
      data: {
        name: 'counter',
        type: 1,
        options: [{ name: 'hero', type: 3, value: 'notarealhero' }],
      },
    });
    const signature = mockSignature(body, timestamp);
    const res = await worker.fetch('/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      },
      body,
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect((json as any).data.content).toMatch(/Error/i);
  });
});
