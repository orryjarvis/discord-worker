import { signRequest } from "./setup.shared";

function requireLiveBaseUrl(): string {
  const liveBaseUrl = process.env.LIVE_BASE_URL?.trim();

  if (!liveBaseUrl) {
    throw new Error('LIVE_BASE_URL must be set for smoke tests');
  }

  return liveBaseUrl;
}

const baseUrl = requireLiveBaseUrl();

export async function signAndSendRequest(body: object): Promise<Response> {
  const request = await signRequest(body);
  return await fetch(baseUrl + '/', request);
}

export function waitForFollowUp(_token: string): Promise<never> {
  return Promise.reject(new Error('waitForFollowUp is not available in smoke mode'));
}
