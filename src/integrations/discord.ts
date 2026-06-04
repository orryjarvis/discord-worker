import type {
  RESTPostAPIChannelMessageJSONBody,
  RESTAPIMessageReference,
  RESTPatchAPIWebhookWithTokenMessageJSONBody,
  RESTPostAPIWebhookWithTokenJSONBody,
} from 'discord-api-types/v10';

export type EditOriginalInteractionPayload = RESTPatchAPIWebhookWithTokenMessageJSONBody;
export type CreateFollowUpMessagePayload = RESTPostAPIWebhookWithTokenJSONBody & {
  message_reference?: Pick<RESTAPIMessageReference, 'message_id' | 'fail_if_not_exists'>;
};

export type CreateChannelMessagePayload = RESTPostAPIChannelMessageJSONBody;

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

export async function createChannelMessage(
  channelId: string,
  botToken: string,
  payload: CreateChannelMessagePayload,
  apiBaseUrl: string,
): Promise<Response> {
  const url = `${apiBaseUrl}/channels/${channelId}/messages`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteOriginalInteractionResponse(
  applicationId: string,
  token: string,
  botToken: string,
  apiBaseUrl: string,
): Promise<Response> {
  const url = `${apiBaseUrl}/webhooks/${applicationId}/${token}/messages/@original`;
  return fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  });
}
