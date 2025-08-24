import type { DotaHero, DotaMatchup } from '../types/commandTypes';
import { inject, injectable } from 'tsyringe';
import { Configuration } from '../config';
import { ObjectStorage } from './objectStorage';

const OPENDOTA_API_BASE = 'https://api.opendota.com/api';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

@injectable()
export class DotaService {

    constructor(@inject(Configuration) private config: Configuration, @inject(ObjectStorage) private kv: ObjectStorage) {}

    async getHeroIdByName(heroName: string): Promise<number | null> {
        const res = await fetch(`${OPENDOTA_API_BASE}/heroes`);
        const heroes = await res.json() as DotaHero[];
        const hero = heroes.find((h) =>
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

        // Fetch matchup data
        const res = await fetch(`${OPENDOTA_API_BASE}/heroes/${heroId}/matchups`);
        const matchups = await res.json() as DotaMatchup[];

        // Sort by highest win rate against the hero
        const counters = matchups
            .map((m) => ({
                hero_id: m.hero_id,
                win_rate: m.wins / m.games_played,
            }))
            .sort((a, b) => a.win_rate - b.win_rate)
            .slice(0, topN);

        // Fetch hero names for counter IDs
        const allHeroesRes = await fetch(`${OPENDOTA_API_BASE}/heroes`);
        const allHeroes = await allHeroesRes.json() as DotaHero[];

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
