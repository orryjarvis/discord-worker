/**
 * Reddit Command Handler
 * Uses redditService for external API calls
 */
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord-api-types/v10';
import { JsonResponse } from '../index';

export async function redditCommandHandler(interaction: any, env: any, deps: { redditService: { getMedia: (subreddit: string) => Promise<string> } }) {
  if (interaction.data.type === ApplicationCommandType.ChatInput) {
    const option = interaction.data.options?.find((p: any) => p.name === 'subreddit');
    if (option?.type === ApplicationCommandOptionType.String) {
      const url = await deps.redditService.getMedia(option.value);
      return new JsonResponse({
        type: 4,
        data: { content: url },
      });
    }
  }
  return new Response('Unknown Type', { status: 400 });
}
