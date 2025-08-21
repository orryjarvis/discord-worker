/**
 * Reddit Command Handler
 * Uses redditService for external API calls
 */
import { injectable } from 'tsyringe';
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord-api-types/v10';
import { JsonResponse } from '../index';
import { RedditService } from '../services/redditService';
import { ICommandHandler, Env } from '../types';

@injectable({token: 'ICommandHandler'})
export class RedditCommand implements ICommandHandler {
  readonly commandId = 'reddit';
  constructor(private redditService: RedditService) {}

  async handle(interaction: unknown, env: Env): Promise<Response> {
    const typedInteraction = interaction as { data: { type: number; options?: { name: string; value: string; type?: number }[] } };
    if (typedInteraction.data.type === ApplicationCommandType.ChatInput) {
      const option = typedInteraction.data.options?.find((p: { name: string }) => p.name === 'subreddit');
      if (option && option.type === ApplicationCommandOptionType.String) {
        const subredditValue = option.value;
        const url = await this.redditService.getMedia(subredditValue);
        return new JsonResponse({
          type: 4,
          data: { content: url },
        });
      }
    }
    return new Response('Unknown Type', { status: 400 });
  }
}
