/**
 * Discord Service
 * Encapsulates all Discord API calls
 */
function getDiscordCommandUrl(applicationId: string, guildId?: string, commandId?: string): string {
  return `https://discord.com/api/v10/applications/${applicationId}/${guildId ? `guilds/${guildId}/` : ''}commands${commandId ? `/${commandId}` : ''}`;
}

export const discordService = {
  getInviteUrl(applicationId: string): string {
    return `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
  },
  async upsertCommands(applicationId: string, token: string, commands: any[], guildId?: string): Promise<Response> {
    const url = getDiscordCommandUrl(applicationId, guildId);
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${token}`,
      },
      method: 'PUT',
      body: JSON.stringify(commands),
    });
    return response;
  },
  async getCommands(applicationId: string, token: string, guildId?: string) {
    const url = getDiscordCommandUrl(applicationId, guildId);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${token}`,
      },
      method: 'GET'
    });
    return await response.json();
  },
  async deleteCommand(applicationId: string, token: string, commandId: string, guildId?: string) {
    const url = getDiscordCommandUrl(applicationId, guildId, commandId);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${token}`,
      },
      method: 'DELETE'
    });
    return await response.json();
  },
};
