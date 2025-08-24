/**
 * Refresh Command Handler
 * Uses discordService for command upsert
 */
import { inject, injectable } from 'tsyringe';
import { DiscordService } from '../services/discordService';
import { ICommandHandler, Env, JsonResponse } from '../types';

@injectable({token: 'ICommandHandler'})
export class RefreshCommand implements ICommandHandler {
  readonly commandId = 'refresh';
  constructor(@inject(DiscordService) private discordService: DiscordService) {}

  async handle(interaction: any, env: Env): Promise<Response> {
    await this.discordService.upsertCommands(env.DISCORD_APPLICATION_ID, env.DISCORD_TOKEN, [], env.DISCORD_GUILD_ID);
    return new JsonResponse({
      type: 4,
      data: { content: `${env.DISCORD_GUILD_ID ? 'Server' : 'Global'} commands refreshed` },
    });
  }
}
