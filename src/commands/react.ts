/**
 * React Command Handler
 * Uses reactService for external API calls
 */
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord-api-types/v10';
import { JsonResponse } from '../index';
import type { ReactCommandDeps } from '../types/commandTypes';

export async function reactCommandHandler(interaction: unknown, env: unknown, deps: unknown) {
  const typedDeps = deps as ReactCommandDeps;
  const typedInteraction = interaction as { data: { type: number; options?: { name: string; value: string; type?: number }[] } };
  if (typedInteraction.data.type === ApplicationCommandType.ChatInput) {
    const option = typedInteraction.data.options?.find((p: { name: string }) => p.name === 'emote');
    if (option && option.type === ApplicationCommandOptionType.String) {
      const emoteValue = option.value;
      const val = await typedDeps.reactService.react(emoteValue, env);
      return new JsonResponse({
        type: 4,
        data: { content: `Reacted ${emoteValue} for the ${val} time` },
      });
    }
  }
  return new Response('Unknown Type', { status: 400 });
}
