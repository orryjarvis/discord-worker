/**
 * Refresh Command Handler
 * Uses discordService for command upsert
 */
import { JsonResponse } from '../index';
import type { RefreshCommandDeps } from '../types/commandTypes';

export async function refreshCommandHandler(interaction: unknown, env: unknown, deps: unknown) {
  const typedDeps = deps as RefreshCommandDeps;
  const applicationId = (env as Record<string, unknown>)["DISCORD_APPLICATION_ID"] as string;
  const token = (env as Record<string, unknown>)["DISCORD_TOKEN"] as string;
  const guildId = (env as Record<string, unknown>)["DISCORD_GUILD_ID"] as string;
  await typedDeps.discordService.upsertCommands(applicationId, token, typedDeps.commands, guildId);
  return new JsonResponse({
    type: 4,
    data: { content: `${guildId ? 'Server' : 'Global'} commands refreshed` },
  });
}
