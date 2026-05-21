import * as ed from '@noble/ed25519';
import type {
  RESTAPIMessageReference,
  RESTPatchAPIWebhookWithTokenMessageJSONBody,
  RESTPostAPIWebhookWithTokenJSONBody,
} from 'discord-api-types/v10';

export type EditOriginalInteractionPayload = RESTPatchAPIWebhookWithTokenMessageJSONBody;
export type CreateFollowUpMessagePayload = RESTPostAPIWebhookWithTokenJSONBody & {
  message_reference?: Pick<RESTAPIMessageReference, 'message_id' | 'fail_if_not_exists'>;
};

export async function verifyDiscordRequest(
  signature: string,
  timestamp: string,
  body: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const message = new TextEncoder().encode(timestamp + body);
    return await ed.verifyAsync(
      ed.etc.hexToBytes(signature),
      message,
      ed.etc.hexToBytes(publicKey),
    );
  } catch {
    return false;
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json;charset=UTF-8' },
  });
}

export async function editOriginalInteractionResponse(
  applicationId: string,
  token: string,
  botToken: string,
  payload: EditOriginalInteractionPayload,
  apiBaseUrl: string,
): Promise<Response> {
  const url = `${apiBaseUrl}/webhooks/${applicationId}/${token}/messages/@original`;
  return fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function createFollowUpMessage(
  applicationId: string,
  token: string,
  botToken: string,
  payload: CreateFollowUpMessagePayload,
  apiBaseUrl: string,
): Promise<Response> {
  const url = `${apiBaseUrl}/webhooks/${applicationId}/${token}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(payload),
  });
}
