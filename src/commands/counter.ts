import { DotaService } from '../services/dotaService';

export async function counterCommand(interaction: any, env: any, deps: any): Promise<Response> {
    // Discord interaction options
    const options = interaction.data.options || [];
    const heroOption = options.find((opt: any) => opt.name === 'hero');
    const heroName = heroOption ? heroOption.value : '';
    const kv = env.DOTA_KV || env.KV || env.kv; // Adjust to your binding name

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

    const dotaService = new DotaService(kv);

    try {
        const counters = await dotaService.getHeroCounters(heroName);
        if (counters.length === 0) {
            return reply(`No counters found for "${heroName}".`);
        }
        return reply(
            `Top counters for **${heroName}**: ${counters.map(h => `\`${h}\``).join(', ')}`
        );
    } catch (err: any) {
        return reply(`Error: ${err.message}`);
    }
}
