import * as ed from '@noble/ed25519';

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
  content: string,
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;
  await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify({ content }),
  });
}
