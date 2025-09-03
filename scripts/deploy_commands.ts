import 'reflect-metadata';
import { COMMANDS } from "../src/commands.js";
import { DiscordService } from "../src/services/discordService.js";
import { Env } from '../src/types.js';
import createClient from 'openapi-fetch';
import type { paths as DiscordPaths } from '../src/generated/discord';

export async function deployCommands() {
    const env = process.env as unknown as Env;
    const client = createClient<DiscordPaths>({ baseUrl: env.DISCORD_URL, fetch });
    const discord = new DiscordService(env, client as any);
    const creationResponse = await discord.upsertCommands(COMMANDS, process.env.DISCORD_GUILD_ID);
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
