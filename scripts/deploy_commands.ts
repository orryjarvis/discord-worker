import 'reflect-metadata';
import { COMMANDS } from "../src/commands.js";
import { DiscordService } from "../src/services/discordService.js";
import { Configuration } from '../src/config.js';
import { Env } from '../src/types.js';
import { DiscordTransport } from '../src/services/discordTransport.js';

export async function deployCommands() {
    const config = new Configuration(process.env as unknown as Env);
    const transport = new DiscordTransport(config);
    const creationResponse = await new DiscordService(config, transport).upsertCommands(COMMANDS, process.env.DISCORD_GUILD_ID);
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
