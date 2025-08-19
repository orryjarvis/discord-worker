/**
 * Refresh Command Handler
 * Uses discordService for command upsert
 */
import { JsonResponse } from '../index';

export async function refreshCommandHandler(interaction: any, env: any, deps: { discordService: { upsertCommands: (applicationId: string, token: string, commands: any, guildId: string) => Promise<void> }, commands: any }) {
  const applicationId = env.DISCORD_APPLICATION_ID;
  const token = env.DISCORD_TOKEN;
  const guildId = env.DISCORD_GUILD_ID;
  await deps.discordService.upsertCommands(applicationId, token, deps.commands, guildId);
  return new JsonResponse({
    type: 4,
    data: { content: `${guildId ? 'Server' : 'Global'} commands refreshed` },
  });
}
