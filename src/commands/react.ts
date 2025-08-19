/**
 * React Command Handler
 * Uses reactService for external API calls
 */
import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord-api-types/v10';
import { JsonResponse } from '../index';

export async function reactCommandHandler(interaction: any, env: any, deps: { reactService: { react: (emote: string, env: any) => Promise<number> } }) {
  if (interaction.data.type === ApplicationCommandType.ChatInput) {
    const option = interaction.data.options?.find((p: any) => p.name === 'emote');
    if (option?.type === ApplicationCommandOptionType.String) {
      const val = await deps.reactService.react(option.value, env);
      return new JsonResponse({
        type: 4,
        data: { content: `Reacted ${option.value} for the ${val} time` },
      });
    }
  }
  return new Response('Unknown Type', { status: 400 });
}
