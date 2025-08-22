/**
 * React Command Handler
 * Uses reactService for external API calls
 */
import { inject, injectable } from 'tsyringe';
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord-api-types/v10';
import { JsonResponse } from '../index';
import { ReactService } from '../services/reactService';
import { Env, ICommandHandler } from '../types';

@injectable({token: 'ICommandHandler'})
export class ReactCommand implements ICommandHandler {
  readonly commandId = 'react';
  constructor(@inject(ReactService)private reactService: ReactService) {}

  async handle(interaction: unknown, env: Env): Promise<Response> {
    const typedInteraction = interaction as { data: { type: number; options?: { name: string; value: string; type?: number }[] } };
    if (typedInteraction.data.type === ApplicationCommandType.ChatInput) {
      const option = typedInteraction.data.options?.find((p: { name: string }) => p.name === 'emote');
      if (option && option.type === ApplicationCommandOptionType.String) {
        const emoteValue = option.value;
        const val = await this.reactService.react(emoteValue, env as Env);
        return new JsonResponse({
          type: 4,
          data: { content: `Reacted ${emoteValue} for the ${val} time` },
        });
      }
    }
    return new Response('Unknown Type', { status: 400 });
  }
}
