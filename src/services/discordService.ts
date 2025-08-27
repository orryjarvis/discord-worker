import { inject, injectable } from 'tsyringe';
import type { DiscordCommand } from '../types/commandTypes';
import type { Env } from '../types.js';

@injectable()
export class DiscordService {

  constructor(@inject('Env') private env: Env) {}

  getInviteUrl(): string {
    const applicationId = this.env.DISCORD_APPLICATION_ID;
    return `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
  }

  async upsertCommands(commands: DiscordCommand[], guildId?: string): Promise<Response> {
    const applicationId = this.env.DISCORD_APPLICATION_ID;
    const botToken = this.env.DISCORD_TOKEN;
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
