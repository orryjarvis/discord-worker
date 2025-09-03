import { inject, injectable } from 'tsyringe';
import { ApplicationCommandType, ApplicationCommandOptionType, APIInteraction } from 'discord-api-types/v10';
import { JsonResponse } from '../types';
import { ICommandHandler } from '../commanding/handler';
import { Slash, StringOpt } from '../commanding/decorators.js';
import { toDiscordResponse } from '../commanding/discordRuntime.js';
import { RedditGetMedia } from './reddit.logic.js';
import type { NativeCommandRequest } from '../commanding/parser.js';
import type { CommandResult } from '../commanding/contracts.js';

@Slash({ name: 'reddit', description: 'Drop some media from a subreddit.' })
@StringOpt({ name: 'subreddit', description: 'The subreddit to get media from', required: true })
@injectable({token: 'ICommandHandler'})
export class RedditCommand implements ICommandHandler {
  readonly commandId = 'reddit';
  constructor(@inject(RedditGetMedia) private reddit: RedditGetMedia) {}

  // Native path used by the DiscordApplicationRouter when available
  async handleNative(req: NativeCommandRequest): Promise<CommandResult> {
    const raw = req.input?.['subreddit'];
    const subreddit = typeof raw === 'string' ? raw.trim() : '';
    if (!subreddit) return { kind: 'content', text: 'Missing required option: subreddit', ephemeral: true };
    return this.reddit.execute({ subreddit });
  }

  async handle(interaction: APIInteraction): Promise<Response> {
    const typedInteraction = interaction as { data: { type: number; options?: { name: string; value: string; type?: number }[] } };
    if (typedInteraction.data.type === ApplicationCommandType.ChatInput) {
      const option = typedInteraction.data.options?.find((p: { name: string }) => p.name === 'subreddit');
      if (option && option.type === ApplicationCommandOptionType.String) {
        const subreddit = option.value;
        const res = await this.reddit.execute({ subreddit });
        return new JsonResponse(toDiscordResponse(res));
      }
    }
    return new Response('Unknown Type', { status: 400 });
  }
}
