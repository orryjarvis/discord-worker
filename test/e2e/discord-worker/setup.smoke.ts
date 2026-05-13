import { signRequest } from './setup.shared.js';

const baseUrl = process.env.LIVE_BASE_URL ?? 'http://127.0.0.1:8787';

export async function signAndSendRequest(body: object): Promise<Response> {
  const request = await signRequest(body);
  return fetch(`${baseUrl}/`, request);
}
