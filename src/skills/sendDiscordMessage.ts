import { createChannelMessage, type CreateChannelMessagePayload } from '@/integrations/discord';

export interface SendDiscordMessageEnv {
  DISCORD_TOKEN: string;
  DISCORD_API_BASE_URL?: string;
}

export interface SendDiscordMessageInput {
  channelId: string;
  content: string;
  allowedMentions?: CreateChannelMessagePayload['allowed_mentions'];
  failurePrefix?: string;
}

async function describePostFailure(response: Response): Promise<string> {
  const body = (await response.text()).trim();
  if (!body) {
    return '';
  }

  try {
    const parsed = JSON.parse(body) as { message?: string; code?: number };
    if (typeof parsed.message === 'string' || typeof parsed.code === 'number') {
      const code = typeof parsed.code === 'number' ? ` code=${parsed.code}` : '';
      const message = typeof parsed.message === 'string' ? ` message=${parsed.message}` : '';
      return `${code}${message}`.trim();
    }
  } catch {
    // Fall through to non-JSON fallback.
  }

  const truncatedBody = body.length > 300 ? `${body.slice(0, 300)}...` : body;
  return `body=${truncatedBody}`;
}

export async function sendDiscordMessage(
  input: SendDiscordMessageInput,
  env: SendDiscordMessageEnv,
): Promise<void> {
  const apiBaseUrl = env.DISCORD_API_BASE_URL ?? 'https://discord.com/api/v10';
  const response = await createChannelMessage(
    input.channelId,
    env.DISCORD_TOKEN,
    {
      content: input.content,
      ...(input.allowedMentions ? { allowed_mentions: input.allowedMentions } : {}),
    },
    apiBaseUrl,
  );

  if (!response.ok) {
    const details = await describePostFailure(response);
    const detailSuffix = details ? ` (${details})` : '';
    const prefix = input.failurePrefix ?? 'Failed to post Discord channel message';
    throw new Error(`${prefix}: ${response.status} ${response.statusText}${detailSuffix}`);
  }
}
