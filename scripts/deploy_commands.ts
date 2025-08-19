import { COMMANDS } from "../src/commands.js";
import { discordService } from "../src/services/discordService.js";

export const TOKEN = process.env.DISCORD_TOKEN;
export const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
export const GUILD_ID = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;

export async function deployCommands() {
    if (!TOKEN) {
        throw new Error('The DISCORD_TOKEN environment variable is required.');
    }
    if (!APPLICATION_ID) {
        throw new Error('The DISCORD_APPLICATION_ID environment variable is required.');
    }
    const creationResponse = await discordService.upsertCommands(APPLICATION_ID, TOKEN, COMMANDS, GUILD_ID);
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
