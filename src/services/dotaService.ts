import createClient from 'openapi-fetch';
import type { paths } from '../generated/opendota';
import type { DotaHero, DotaMatchup } from '../types/commandTypes';
import { inject, injectable } from 'tsyringe';
import type { Env } from '../types.js';
import { ObjectStorage } from './objectStorage';

const OPENDOTA_API_BASE = 'https://api.opendota.com/api';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

@injectable()
export class DotaService {

    constructor(@inject('Env') private env: Env, @inject(ObjectStorage) private kv: ObjectStorage) {}

    async getHeroIdByName(heroName: string): Promise<number | null> {
    const client = createClient<paths>({ baseUrl: OPENDOTA_API_BASE, fetch });
    const { data: heroes, response: heroesResp } = await client.GET('/heroes');
    if (!heroesResp.ok) throw new Error(`OpenDota error fetching heroes: ${heroesResp.status}`);
    // The generated type for heroes items is components["schemas"]["HeroObjectResponse"],
    // we map to our minimal local DotaHero shape used elsewhere.
    const heroesSlim: DotaHero[] = (heroes ?? []).map((h) => ({ id: (h as any).id, localized_name: (h as any).localized_name }));
    const hero = heroesSlim.find((h) =>
            h.localized_name.toLowerCase() === heroName.toLowerCase()
        );
        return hero ? hero.id : null;
    }

    async getHeroCounters(heroName: string, topN = 5): Promise<string[]> {
        const cacheKey = `counters:${heroName.toLowerCase()}`;
        const now = Date.now();

        // Try to get from KV
        const cachedRaw = await this.kv.get_json('DotaService', cacheKey) as { counters: string[]; expires: number } | null;
        if (cachedRaw && cachedRaw.expires > now) {
            return cachedRaw.counters;
        }

        const heroId = await this.getHeroIdByName(heroName);
        if (!heroId) throw new Error(`Hero "${heroName}" not found.`);

        // Fetch matchup data using typed client
    const client = createClient<paths>({ baseUrl: OPENDOTA_API_BASE, fetch });
    const { data: matchupData, response: matchupsResp } = await client.GET('/heroes/{hero_id}/matchups', {
            params: { path: { hero_id: heroId } }
        });
    if (!matchupsResp.ok) throw new Error(`OpenDota error fetching matchups: ${matchupsResp.status}`);
        const matchups = (matchupData ?? []) as unknown as DotaMatchup[];

        // Sort by highest win rate against the hero
        const counters = matchups
            .map((m) => ({
                hero_id: m.hero_id,
                win_rate: m.wins / m.games_played,
            }))
            .sort((a, b) => a.win_rate - b.win_rate)
            .slice(0, topN);

    // Fetch hero names for counter IDs using typed client
    const { data: allHeroesData, response: heroes2Resp } = await client.GET('/heroes');
    if (!heroes2Resp.ok) throw new Error(`OpenDota error fetching heroes: ${heroes2Resp.status}`);
    const allHeroes = (allHeroesData ?? []).map((h) => ({ id: (h as any).id, localized_name: (h as any).localized_name })) as DotaHero[];

        const counterNames = counters.map((c) => {
            const hero = allHeroes.find((h) => h.id === c.hero_id);
            return hero ? hero.localized_name : `Hero ID ${c.hero_id}`;
        });

        // Store in KV
        await this.kv.put(
            'DotaService',
            cacheKey,
            JSON.stringify({
                counters: counterNames,
                expires: now + CACHE_TTL_MS,
            }),
            { expirationTtl: CACHE_TTL_MS / 1000 }
        );

        return counterNames;
    }
}
