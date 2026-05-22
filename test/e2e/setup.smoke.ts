import { signRequest } from "./setup.shared";

function requireLiveBaseUrl(): string {
  const liveBaseUrl = process.env.LIVE_BASE_URL?.trim();

  if (!liveBaseUrl) {
    throw new Error('LIVE_BASE_URL must be set for smoke tests');
  }

  return liveBaseUrl;
}

const baseUrl = requireLiveBaseUrl();

function getFollowUpTimeoutMs(): number {
  const raw = process.env.SMOKE_FOLLOWUP_TIMEOUT_MS;
  if (!raw) {
    return 60000;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('SMOKE_FOLLOWUP_TIMEOUT_MS must be a positive number when set');
  }

  return Math.floor(parsed);
}

const defaultFollowUpTimeoutMs = getFollowUpTimeoutMs();

export async function signAndSendRequest(body: object): Promise<Response> {
  const request = await signRequest(body);
  return await fetch(baseUrl + '/', request);
}

export async function waitForFollowUp(correlationId: string, timeoutMs = defaultFollowUpTimeoutMs): Promise<any> {
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

export async function waitForSubmission(interactionId: string, timeoutMs = defaultFollowUpTimeoutMs): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/__test/submissions/${interactionId}`);
    if (res.status === 200) {
      return res.json();
    }
    await new Promise<void>(r => setTimeout(r, 1000));
  }
  throw new Error(`No submission for interactionId "${interactionId}" received within ${timeoutMs}ms`);
}

export async function waitForChannelPost(channelId: string, timeoutMs = defaultFollowUpTimeoutMs): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/__test/channel-posts/${channelId}`);
    if (res.status === 200) {
      return res.json();
    }
    await new Promise<void>(r => setTimeout(r, 1000));
  }
  throw new Error(`No channel post for channelId "${channelId}" received within ${timeoutMs}ms`);
}

export async function clearChannelPost(channelId: string): Promise<void> {
  await fetch(`${baseUrl}/__test/channel-posts/${channelId}`, { method: 'DELETE' });
}

export async function runScheduled(cron: string, time: number): Promise<Response> {
  return fetch(`${baseUrl}/__test/scheduled?cron=${encodeURIComponent(cron)}&time=${encodeURIComponent(String(time))}`);
}
