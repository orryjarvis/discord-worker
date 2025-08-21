/**
 * Invite Command Handler
 * Uses discordService for URL generation
 */
import { JsonResponse } from '../index';
import type { InviteCommandDeps } from '../types/commandTypes';

export async function inviteCommandHandler(interaction: unknown, env: unknown, deps: unknown) {
  const typedDeps = deps as InviteCommandDeps;
  const applicationId = (env as Record<string, unknown>)["DISCORD_APPLICATION_ID"] as string;
  const INVITE_URL = typedDeps.discordService.getInviteUrl(applicationId);
  return new JsonResponse({
    type: 4,
    data: { content: INVITE_URL, flags: 64 },
  });
}
