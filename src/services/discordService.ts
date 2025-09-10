import { inject, injectable } from 'tsyringe';
import type { Env } from '../env';
import { ApiClientTokens } from '../generated';
import type { DiscordClient } from '../generated';

@injectable()
export class DiscordService {

  constructor(
    @inject('Env') private env: Env,
  @inject(ApiClientTokens.discord) private client: DiscordClient,
  ) { }

  getInviteUrl(): string {
    const applicationId = this.env.DISCORD_APPLICATION_ID;
    return `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
  }

  async upsertCommands(commands: unknown[], guildId?: string): Promise<Response> {
    const applicationId = this.env.DISCORD_APPLICATION_ID;
    const botToken = this.env.DISCORD_TOKEN;
    if (guildId) {
      const res = await this.client.PUT('/applications/{application_id}/guilds/{guild_id}/commands', {
        params: { path: { application_id: applicationId, guild_id: guildId } },
        body: commands as any,
        headers: { Authorization: `Bot ${botToken}` },
      });
      return res.response;
    } else {
      const res = await this.client.PUT('/applications/{application_id}/commands', {
        params: { path: { application_id: applicationId } },
        body: commands as any,
        headers: { Authorization: `Bot ${botToken}` },
      });
      return res.response;
    }
  }
}
