import type { paths as OpenDotaAPI } from '../generated/opendota';
import { inject, injectable } from 'tsyringe';
import type { Env } from '../types.js';
import { ObjectStorage } from './objectStorage';
import { ApiClientFactory } from './apiClientFactory';

const OPENDOTA_API_BASE = 'https://api.opendota.com/api';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

@injectable()
export class DotaService {

    constructor(
        @inject('Env') private env: Env,
        @inject(ObjectStorage) private kv: ObjectStorage,
        @inject(ApiClientFactory) private api: ApiClientFactory<OpenDotaAPI>,
    ) {}

    async getHeroIdByName(heroName: string): Promise<number | null> {
    const client = this.api.create({ baseUrl: OPENDOTA_API_BASE });
    const { data: heroes, response: heroesResp } = await client.GET('/heroes', { fetch });
    if (!heroesResp.ok) throw new Error(`OpenDota error fetching heroes: ${heroesResp.status}`);
    const hero = (heroes ?? []).find((h) =>
            (h as any).localized_name?.toLowerCase() === heroName.toLowerCase()
        ) as any;
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
    const client = this.api.create({ baseUrl: OPENDOTA_API_BASE }) as unknown as import('openapi-fetch').Client<paths>;
    const { data: matchupData, response: matchupsResp } = await client.GET('/heroes/{hero_id}/matchups', {
            params: { path: { hero_id: heroId } },
            fetch,
        });
    if (!matchupsResp.ok) throw new Error(`OpenDota error fetching matchups: ${matchupsResp.status}`);
    const matchups = (matchupData ?? []) as Array<{ hero_id?: number; wins?: number; games_played?: number }>;

        // Sort by highest win rate against the hero
        const counters = matchups
            .map((m) => ({
                hero_id: m.hero_id ?? -1,
                win_rate: (m.wins ?? 0) / Math.max(1, m.games_played ?? 1),
            }))
            .sort((a, b) => a.win_rate - b.win_rate)
            .slice(0, topN);

    // Fetch hero names for counter IDs using typed client
    const { data: allHeroesData, response: heroes2Resp } = await client.GET('/heroes', { fetch });
    if (!heroes2Resp.ok) throw new Error(`OpenDota error fetching heroes: ${heroes2Resp.status}`);
    const allHeroes = (allHeroesData ?? []).map((h) => ({ id: (h as any).id, localized_name: (h as any).localized_name })) as Array<{ id: number; localized_name?: string }>;

        const counterNames = counters.map((c) => {
            const hero = allHeroes.find((h) => h.id === c.hero_id);
            return hero ? (hero.localized_name ?? `Hero ID ${c.hero_id}`) : `Hero ID ${c.hero_id}`;
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
