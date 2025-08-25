import { inject, injectable } from 'tsyringe';
import { ApplicationCommandType, ApplicationCommandOptionType, APIInteraction } from 'discord-api-types/v10';
import { JsonResponse } from '../types';
import { RedditService } from '../services/redditService';
import { ICommandHandler } from '../types';

@injectable({token: 'ICommandHandler'})
export class RedditCommand implements ICommandHandler {
  readonly commandId = 'reddit';
  constructor(@inject(RedditService) private redditService: RedditService) {}

  async handle(interaction: APIInteraction): Promise<Response> {
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
