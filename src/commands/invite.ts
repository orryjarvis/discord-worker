/**
 * Invite Command Handler
 * Uses discordService for URL generation
 */
import { JsonResponse } from '../index';

export async function inviteCommandHandler(interaction: any, env: any, deps: { discordService: { getInviteUrl: (applicationId: string) => string } }) {
  const applicationId = env.DISCORD_APPLICATION_ID;
  const INVITE_URL = deps.discordService.getInviteUrl(applicationId);
  return new JsonResponse({
    type: 4,
    data: { content: INVITE_URL, flags: 64 },
  });
}
