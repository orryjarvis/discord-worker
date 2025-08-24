/**
 * Invite Command Handler
 * Uses discordService for URL generation
 */
import { inject, injectable } from 'tsyringe';
import { JsonResponse } from '../types';
import { DiscordService } from '../services/discordService';
import { ICommandHandler } from '../types';
import { APIInteraction } from 'discord-api-types/v10';

@injectable({token: 'ICommandHandler'})
export class InviteCommand implements ICommandHandler {
  readonly commandId = 'invite';
  constructor(@inject(DiscordService) private discordService: DiscordService) {}

  async handle(interaction: APIInteraction): Promise<Response> {
    const INVITE_URL = this.discordService.getInviteUrl();
    return new JsonResponse({
      type: 4,
      data: { content: INVITE_URL, flags: 64 },
    });
  }
}
