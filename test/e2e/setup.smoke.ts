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

export async function waitForFollowUp(correlationId: string, timeoutMs = 15000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/__test/followups/${correlationId}`);
    if (res.status === 200) {
      return res.json();
    }
    await new Promise<void>(r => setTimeout(r, 1000));
  }
  throw new Error(`No follow-up for correlationId "${correlationId}" received within ${timeoutMs}ms`);
}
