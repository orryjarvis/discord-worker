import { signRequest } from "./setup.shared";

const baseUrl = process.env.LIVE_BASE_URL ?? 'http://localhost:8787';

export async function signAndSendRequest(body: object): Promise<Response> {
  const request = await signRequest(body);
  return await fetch(baseUrl + '/', request);
}

export function waitForFollowUp(_token: string): Promise<never> {
  return Promise.reject(new Error('waitForFollowUp is not available in smoke mode'));
}
