import { inject, injectable } from 'tsyringe';
import { DotaService } from '../services/dotaService';
import { ICommandHandler } from '../types';
import { APIChatInputApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, InteractionResponseType } from 'discord-api-types/v10';
import { DiscordService } from '../services/discordService';
import { Configuration } from '../config';

@injectable({ token: 'ICommandHandler' })
export class CounterCommand implements ICommandHandler {
  readonly commandId = 'counter';
  constructor(
    @inject(DotaService) private dotaService: DotaService,
    @inject(DiscordService) private discordService: DiscordService,
    @inject(Configuration) private config: Configuration,
  ) { }

  async handle(
    interaction: APIChatInputApplicationCommandInteraction,
    ctx?: ExecutionContext
  ): Promise<Response> {
    const options = Array.isArray(interaction?.data?.options) ? interaction.data.options : [];
    const heroOption = options.find(
      (opt): opt is APIApplicationCommandInteractionDataOption =>
        'value' in opt && opt.name === 'hero'
    ) as {name: string, value: string};
    
  const reply = (content: string, type: number = InteractionResponseType.DeferredChannelMessageWithSource) =>
      new Response(
        JSON.stringify({ type, data: { content } }),
        { headers: { 'content-type': 'application/json' } }
      );

    if (!heroOption) {
      return reply('Please specify a hero name. Example: `/counter phantom lancer`', 4);
    }
    const heroName = heroOption.value;

    const applicationId = String(this.config.get('DISCORD_APPLICATION_ID'));
    const token = (interaction as any).token as string;
    if (ctx) {
      ctx.waitUntil((async () => {
        try {
          const counters = await this.dotaService.getHeroCounters(heroName);
          if (counters.length === 0) {
            await this.discordService.editOriginalResponse(applicationId, token, { content: `No counters found for "${heroName}".` });
            return;
          }
          const formatted = counters.map((h: string) => `\`${h}\``).join(', ');
          await this.discordService.editOriginalResponse(applicationId, token, { content: `Top counters for **${heroName}**: ${formatted}` });
        } catch (err) {
          await this.discordService.editOriginalResponse(applicationId, token, { content: 'Error fetching counters.' });
        }
      })());
    }

  return reply(`Crunching counters for ${heroName}...`, InteractionResponseType.DeferredChannelMessageWithSource);
  }
}
