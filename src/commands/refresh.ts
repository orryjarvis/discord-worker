import { inject, injectable } from 'tsyringe';
import { DiscordService } from '../services/discordService';
import { ICommandHandler, JsonResponse } from '../types';
import { APIInteraction } from 'discord-api-types/v10';

@injectable({token: 'ICommandHandler'})
export class RefreshCommand implements ICommandHandler {
  readonly commandId = 'refresh';
  constructor(@inject(DiscordService) private discordService: DiscordService) {}

  async handle(interaction: APIInteraction): Promise<Response> {
    // TODO this isn't passing anything useful...
    await this.discordService.upsertCommands([], interaction.guild_id);
    return new JsonResponse({
      type: 4,
      data: { content: `server commands refreshed` },
    });
  }
}
