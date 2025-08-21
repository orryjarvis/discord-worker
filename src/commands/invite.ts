/**
 * Invite Command Handler
 * Uses discordService for URL generation
 */
import { injectable } from 'tsyringe';
import { JsonResponse } from '../index';
import { DiscordService } from '../services/discordService';
import { Env, ICommandHandler } from '../types';

@injectable({token: 'ICommandHandler'})
export class InviteCommand implements ICommandHandler {
  readonly commandId = 'invite';
  constructor(private discordService: DiscordService) {}

  async handle(interaction: unknown, env: Env): Promise<Response> {
    const INVITE_URL = this.discordService.getInviteUrl(env.DISCORD_APPLICATION_ID);
    return new JsonResponse({
      type: 4,
      data: { content: INVITE_URL, flags: 64 },
    });
  }
}
