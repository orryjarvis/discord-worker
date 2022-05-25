import { COMMANDS } from "../src/commands.js";
import { upsertCommands } from "../src/api.js";

if (!process.env.DISCORD_TOKEN) {
    throw new Error('The DISCORD_TOKEN environment variable is required.');
}
if (!process.env.DISCORD_APPLICATION_ID) {
    throw new Error(
        'The DISCORD_APPLICATION_ID environment variable is required.'
    );
}

export const TOKEN = process.env.DISCORD_TOKEN;
export const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
export const GUILD_ID = process.env.DISCORD_GUILD_ID;

const creationResponse = await upsertCommands(APPLICATION_ID, TOKEN, COMMANDS, GUILD_ID);

if (creationResponse.ok) {
    console.log('Registered all commands');
} else {
    console.error('Error registering commands');
    const text = await creationResponse.text();
    console.error(text);
}