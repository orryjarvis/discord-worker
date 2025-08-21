/**
 * Reddit Command Handler
 * Uses redditService for external API calls
 */
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord-api-types/v10';
import { JsonResponse } from '../index';
import type { RedditCommandDeps } from '../types/commandTypes';

export async function redditCommandHandler(interaction: unknown, env: unknown, deps: unknown) {
  const typedDeps = deps as RedditCommandDeps;
  const typedInteraction = interaction as { data: { type: number; options?: { name: string; value: string; type?: number }[] } };
  if (typedInteraction.data.type === ApplicationCommandType.ChatInput) {
    const option = typedInteraction.data.options?.find((p: { name: string }) => p.name === 'subreddit');
    if (option && option.type === ApplicationCommandOptionType.String) {
      const subredditValue = option.value;
      const url = await typedDeps.redditService.getMedia(subredditValue);
      return new JsonResponse({
        type: 4,
        data: { content: url },
      });
    }
  }
  return new Response('Unknown Type', { status: 400 });
}
