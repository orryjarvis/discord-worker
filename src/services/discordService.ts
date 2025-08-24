import { inject, injectable } from 'tsyringe';
import type { DiscordCommand } from '../types/commandTypes';
import { Configuration } from '../config';

@injectable()
export class DiscordService {

  constructor(@inject(Configuration) private config: Configuration) {}

  getInviteUrl(): string {
    const applicationId = this.config.get('DISCORD_APPLICATION_ID');
    return `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
  }

  async upsertCommands(commands: DiscordCommand[], guildId?: string): Promise<Response> {
    const applicationId = this.config.get('DISCORD_APPLICATION_ID');
    const botToken = this.config.get('DISCORD_BOT_TOKEN');
    const url = `https://discord.com/api/v10/applications/${applicationId}/${guildId ? `guilds/${guildId}/` : ''}commands`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${botToken}`,
      },
      method: 'PUT',
      body: JSON.stringify(commands),
    });
    return response;
  }
}
