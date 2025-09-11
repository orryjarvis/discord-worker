import { signRequest } from "./setup.shared";

const baseUrl = process.env.LIVE_BASE_URL;
if (!baseUrl) {
  throw new Error('LIVE_BASE_URL is required for smoke tests');
}

export async function signAndSendRequest(body: object): Promise<Response> {
  const request = await signRequest(body);
  return await fetch(baseUrl + '/discord', request);
}
