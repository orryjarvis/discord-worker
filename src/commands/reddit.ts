import { inject, injectable } from 'tsyringe';
import { ApplicationCommandType, ApplicationCommandOptionType, APIInteraction, InteractionResponseType } from 'discord-api-types/v10';
import { JsonResponse } from '../types';
import { RedditService } from '../services/redditService';
import { ICommandHandler } from '../types';
import { DiscordService } from '../services/discordService';
import { Configuration } from '../config';

@injectable({token: 'ICommandHandler'})
export class RedditCommand implements ICommandHandler {
  readonly commandId = 'reddit';
  constructor(
    @inject(RedditService) private redditService: RedditService,
    @inject(DiscordService) private discordService: DiscordService,
    @inject(Configuration) private config: Configuration,
  ) {}

  async handle(interaction: APIInteraction, ctx?: ExecutionContext): Promise<Response> {
    const typedInteraction = interaction as { data: { type: number; options?: { name: string; value: string; type?: number }[] } };
    if (typedInteraction.data.type === ApplicationCommandType.ChatInput) {
      const option = typedInteraction.data.options?.find((p: { name: string }) => p.name === 'subreddit');
      if (option && option.type === ApplicationCommandOptionType.String) {
        const subredditValue = option.value;
        const applicationId = String(this.config.get('DISCORD_APPLICATION_ID'));
        const token = (interaction as any).token as string;
        if (ctx) {
          ctx.waitUntil((async () => {
            try {
              const url = await this.redditService.getMedia(subredditValue);
              await this.discordService.editOriginalResponse(applicationId, token, { content: url });
            } catch (err) {
              await this.discordService.editOriginalResponse(applicationId, token, { content: 'Failed to fetch from Reddit.' });
            }
          })());
        }
        // Deferred response
        return new JsonResponse({
          type: InteractionResponseType.DeferredChannelMessageWithSource,
          data: { content: `Fetching from r/${subredditValue}...`, flags: 64 },
        });
      }
    }
    return new Response('Unknown Type', { status: 400 });
  }
}
