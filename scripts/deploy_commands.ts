import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { slashCommandDefinitions } from '../src/commanding/decorators.js';
import { DiscordService } from "../src/services/discordService.js";
import type { Env } from '../src/types.js';
import createClient from 'openapi-fetch';
import type { paths as DiscordPaths } from '../src/generated/discord';

async function importAllCommands(): Promise<void> {
    // Load all modules in src/commands to trigger decorators and registry population
    const here = path.dirname(fileURLToPath(import.meta.url));
    const commandsDir = path.resolve(here, '..', 'src', 'commands');
    const entries = await fs.readdir(commandsDir);
    const files = entries.filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
    for (const f of files) {
        const full = path.resolve(commandsDir, f);
        // Prefer .ts path for tsx runtime, else .js
        const specifier = full.endsWith('.ts') ? full : full.replace(/\.js$/, '.js');
        await import(pathToFileUrlSafe(specifier));
    }
}

function pathToFileUrlSafe(p: string): string {
    const url = new URL('file:' + (p.startsWith('/') ? '' : '/') + p);
    return url.href;
}

export async function deployCommands() {
        const env = process.env as unknown as Env;
        const client = createClient<DiscordPaths>({ baseUrl: env.DISCORD_URL, fetch });
        const discord = new DiscordService(env, client as any);
        await importAllCommands();
        const combined = [...slashCommandDefinitions];
        const creationResponse = await discord.upsertCommands(combined as unknown[], process.env.DISCORD_GUILD_ID);
    if (creationResponse.ok) {
        console.log('Registered all commands');
    } else {
        console.error('Error registering commands');
        const text = await creationResponse.text();
        console.error(text);
    }
}

// Remove CommonJS require.main check for ESM compatibility
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('deploy_commands.js')) {
    deployCommands();
}
