import { inject, injectable } from 'tsyringe';
import { DotaService } from '../services/dotaService';
import { ICommandHandler } from '../types';
import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataOption } from 'discord-api-types/v10';

@injectable({ token: 'ICommandHandler' })
export class CounterCommand implements ICommandHandler {
  readonly commandId = 'counter';
  constructor(@inject(DotaService) private dotaService: DotaService) { }

  async handle(
    interaction: APIChatInputApplicationCommandInteraction
  ): Promise<Response> {
    const options = Array.isArray(interaction?.data?.options) ? interaction.data.options : [];
    const heroOption = options.find(
      (opt): opt is APIApplicationCommandInteractionDataOption =>
        'value' in opt && opt.name === 'hero'
    ) as {name: string, value: string};
    
    if (!heroOption) {
      return reply('Please specify a hero name. Example: `/counter phantom lancer`');
    }
    const heroName = heroOption.value;

    function reply(content: string) {
      return new Response(
        JSON.stringify({
          type: 4, // Channel message
          data: { content }
        }),
        {
          headers: { 'content-type': 'application/json' }
        }
      );
    }


    try {
      const counters = await this.dotaService.getHeroCounters(heroName);
      if (counters.length === 0) {
        return reply(`No counters found for "${heroName}".`);
      }
      // Format each counter with backticks
      const formatted = counters.map((h: string) => `\`${h}\``).join(', ');
      return reply(`Top counters for **${heroName}**: ${formatted}`);
    } catch (err) {
      return reply('Error fetching counters.');
    }
  }
}
