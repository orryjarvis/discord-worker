import { AWW_COMMAND, Command, INVITE_COMMAND } from "./commands.js";

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const testGuildId = process.env.DISCORD_TEST_GUILD_ID;


if (!token) {
    throw new Error('The DISCORD_TOKEN environment variable is required.');
}
if (!applicationId) {
    throw new Error(
        'The DISCORD_APPLICATION_ID environment variable is required.'
    );
}

/**
 * Register all commands with a specific guild/server. Useful during initial
 * development and testing.
 */
// eslint-disable-next-line no-unused-vars
async function registerGuildCommands() {
    if (!testGuildId) {
        throw new Error(
            'The DISCORD_TEST_GUILD_ID environment variable is required.'
        );
    }
    const url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${testGuildId}/commands`;
    const res = await registerCommands(url);
    const json: any = await res.json();
    console.log(json);
    json.forEach(async (cmd: any) => {
        const response = await fetch(
            `https://discord.com/api/v10/applications/${applicationId}/guilds/${testGuildId}/commands/${cmd.id}`
        );
        if (!response.ok) {
            console.error(`Problem removing command ${cmd.id}`);
        }
    });
}

async function registerGlobalCommands() {
    const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;
    await registerCommands(url);
}

async function registerCommands(url: any) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${token}`,
        },
        method: 'PUT',
        body: JSON.stringify([AWW_COMMAND, INVITE_COMMAND]),
    });

    if (response.ok) {
        console.log('Registered all commands');
    } else {
        console.error('Error registering commands');
        const text = await response.text();
        console.error(text);
    }
    return response;
}

await registerGlobalCommands();
// await registerGuildCommands();