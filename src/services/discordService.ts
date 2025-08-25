import { inject, injectable } from 'tsyringe';
import type { DiscordCommand } from '../types/commandTypes';
import { Configuration } from '../config';
import { APIInteractionResponseCallbackData } from 'discord-api-types/v10';

@injectable()
export class DiscordService {

  constructor(@inject(Configuration) private config: Configuration) {}

  getInviteUrl(): string {
    const applicationId = this.config.get('DISCORD_APPLICATION_ID');
    return `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
  }

  async upsertCommands(commands: DiscordCommand[], guildId?: string): Promise<Response> {
    const applicationId = this.config.get('DISCORD_APPLICATION_ID');
    const botToken = this.config.get('DISCORD_TOKEN');
    const base = (this.config.get('DISCORD_API_BASE') as string) || 'https://discord.com/api/v10';
    const url = `${base}/applications/${applicationId}/${guildId ? `guilds/${guildId}/` : ''}commands`;
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

  async createFollowupMessage(applicationId: string, interactionToken: string, data: APIInteractionResponseCallbackData): Promise<Response> {
    const base = (this.config.get('DISCORD_API_BASE') as string) || 'https://discord.com/api/v10';
    const url = `${base}/webhooks/${applicationId}/${interactionToken}`;
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async editOriginalResponse(applicationId: string, interactionToken: string, data: APIInteractionResponseCallbackData): Promise<Response> {
    const base = (this.config.get('DISCORD_API_BASE') as string) || 'https://discord.com/api/v10';
    const url = `${base}/webhooks/${applicationId}/${interactionToken}/messages/@original`;

    // Optional mirror for smoke tests
    const mirrorUrl = (this.config.get('FOLLOWUP_MIRROR_URL') as string) || '';
    if (mirrorUrl) {
      // Fire-and-forget mirror; don't await to avoid affecting latency
      fetch(mirrorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'editOriginalResponse',
          applicationId,
          interactionToken,
          data,
          at: new Date().toISOString(),
        }),
      }).catch((err) => {
        // Swallow mirror errors in tests; do not fail primary flow. Note: avoid logging to keep tests clean.
        void err; // reference to avoid unused-var lint
      });
    }

    // Dry-run mode: don't hit Discord in smoke
    const dryRun = String(this.config.get('DRY_RUN_FOLLOWUPS') || '').toLowerCase() === 'true';
    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, dryRun: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
}
