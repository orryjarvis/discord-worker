import { inject, injectable } from 'tsyringe';
import { DotaService } from '../services/dotaService';
import { Env, ICommandHandler } from '../types';

@injectable({token: 'ICommandHandler'})
export class CounterCommand implements ICommandHandler{
  readonly commandId = 'counter';
  constructor(@inject(DotaService) private dotaService: DotaService) {}

  async handle(
    interaction: { data: { options?: Array<{ name: string; value: string }> } },
    env: Env
  ): Promise<Response> {
    // Discord interaction options
    const options: Array<{ name: string; value: string }> = interaction.data.options || [];
    const heroOption = options.find(opt => opt.name === 'hero');
    const heroName: string = heroOption ? heroOption.value : '';
    const kv = env.KV
    if (!kv) {
      return new Response('KV binding not found', { status: 500 });
    }

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

    if (!heroName) {
      return reply('Please specify a hero name. Example: `/counter phantom lancer`');
    }

    try {
      const counters = await this.dotaService.getHeroCounters(heroName, env.KV);
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
