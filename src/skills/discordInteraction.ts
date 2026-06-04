import type { FollowUpExecutionResult } from '../core/index.js';
import { editOriginalInteractionResponse, type EditOriginalInteractionPayload } from '../integrations/discord.js';

const QUOTED_SOURCE_MAX_LENGTH = 240;
const QUOTED_SOURCE_ELLIPSIS = '...';

export interface DeliverFollowUpEnv {
  DISCORD_APPLICATION_ID: string;
  DISCORD_TOKEN: string;
  DISCORD_API_BASE_URL?: string;
}

function formatQuotedSourceText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const truncationStart = QUOTED_SOURCE_MAX_LENGTH - QUOTED_SOURCE_ELLIPSIS.length;
  const truncated = normalized.length > QUOTED_SOURCE_MAX_LENGTH
    ? `${normalized.slice(0, truncationStart)}${QUOTED_SOURCE_ELLIPSIS}`
    : normalized;
  return `> ${truncated}`;
}

export function buildFollowUpContent(result: FollowUpExecutionResult): string {
  const quotedSourceText = result.renderHints?.quotedSourceText;
  if (!quotedSourceText) {
    return result.content;
  }

  const quotedAuthor = result.renderHints?.quotedSourceAuthorId
    ? ` - <@${result.renderHints.quotedSourceAuthorId}>`
    : '';
  const fallbackPrefix = result.renderHints?.quotedFallbackPrefix
    ? `${result.renderHints.quotedFallbackPrefix} `
    : '';
  return `${formatQuotedSourceText(quotedSourceText)}${quotedAuthor}\n\n${fallbackPrefix}${result.content}`;
}

export async function deliverFollowUpEdit(
  token: string,
  result: FollowUpExecutionResult,
  env: DeliverFollowUpEnv,
): Promise<void> {
  const content = buildFollowUpContent(result);
  const payload: EditOriginalInteractionPayload = {
    content,
    ...(result.renderHints?.quotedSourceText
      ? { allowed_mentions: { parse: [] } }
      : {}),
  };
  const apiBaseUrl = env.DISCORD_API_BASE_URL ?? 'https://discord.com/api/v10';
  const response = await editOriginalInteractionResponse(
    env.DISCORD_APPLICATION_ID,
    token,
    env.DISCORD_TOKEN,
    payload,
    apiBaseUrl,
  );
  if (!response.ok) {
    throw new Error(`Failed to edit original interaction response: ${response.status} ${response.statusText}`);
  }
}
