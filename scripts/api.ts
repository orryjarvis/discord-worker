import { Command } from "../src/commands.js";


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

function getDiscordCommandUrl(applicationId: string, guildId?: string, commandId?: string): string {
    return `https://discord.com/api/v10/applications/${applicationId}/${guildId ? `guilds/${guildId}/` : ""}commands${commandId ? `/${commandId}` : ""}`
}

export async function upsertCommands(applicationId: string, token: string, commands: Command[], guildId?: string): Promise<Response> {
    const url = getDiscordCommandUrl(applicationId);
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${token}`,
        },
        method: 'PUT',
        body: JSON.stringify(commands),
    });
    return response;
}

export async function getCommands(applicationId: string, token: string, guildId?: string) {
    const url = getDiscordCommandUrl(applicationId);
    const response = await fetch(url, {
        headers: {
            Authorization: `Bot ${token}`,
        },
        method: 'GET'
    });
    return await response.json();
}

export async function deleteCommand(applicationId: string, token: string, commandId: string, guildId?: string) {
    const url = getDiscordCommandUrl(applicationId, guildId, commandId);
    const response = await fetch(url, {
        headers: {
            Authorization: `Bot ${token}`,
        },
        method: 'DELETE'
    });
    return await response.json();
}