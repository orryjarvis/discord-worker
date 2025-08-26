import { inject, injectable } from 'tsyringe';
import type { DiscordCommand } from '../types/commandTypes';
import { Configuration } from '../config';
import { APIInteractionResponseCallbackData } from 'discord-api-types/v10';
import { DiscordTransport } from './discordTransport';

@injectable()
export class DiscordService {

  constructor(@inject(Configuration) private config: Configuration, @inject(DiscordTransport) private transport: DiscordTransport) {}

  getInviteUrl(): string {
    const applicationId = this.config.get('DISCORD_APPLICATION_ID');
    return `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
  }

  async upsertCommands(commands: DiscordCommand[], guildId?: string): Promise<Response> {
    const applicationId = this.config.get('DISCORD_APPLICATION_ID');
    const url = `/applications/${applicationId}/${guildId ? `guilds/${guildId}/` : ''}commands`;
    return await this.transport.fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bot ${this.config.get('DISCORD_TOKEN')}` },
      body: JSON.stringify(commands),
    });
  }

  async createFollowupMessage(applicationId: string, interactionToken: string, data: APIInteractionResponseCallbackData): Promise<Response> {
  const url = `/webhooks/${applicationId}/${interactionToken}`;
  return await this.transport.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async editOriginalResponse(applicationId: string, interactionToken: string, data: APIInteractionResponseCallbackData): Promise<Response> {
  const url = `/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  return await this.transport.fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
}
