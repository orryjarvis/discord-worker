import { DotaService } from '../services/dotaService';
import type { KVNamespace } from '@cloudflare/workers-types';

export async function counterCommand(
    interaction: { data: { options?: Array<{ name: string; value: string }> } },
    env: { DOTA_KV?: KVNamespace; KV?: KVNamespace; kv?: KVNamespace }
): Promise<Response> {
    // Discord interaction options
    const options: Array<{ name: string; value: string }> = interaction.data.options || [];
    const heroOption = options.find(opt => opt.name === 'hero');
    const heroName: string = heroOption ? heroOption.value : '';
    const kv = env.DOTA_KV || env.KV || env.kv;
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

    const dotaService = new DotaService(kv);

    try {
        const counters = await dotaService.getHeroCounters(heroName);
        if (counters.length === 0) {
            return reply(`No counters found for "${heroName}".`);
        }
        // Format each counter with backticks
        const formatted = counters.map((h: string) => `\`${h}\``).join(', ');
        return reply(`Top counters for **${heroName}**: ${formatted}`);
    } catch (err) {
        if (err instanceof Error) {
            return reply(`Error: ${err.message}`);
        }
        return reply('Unknown error');
    }
}
