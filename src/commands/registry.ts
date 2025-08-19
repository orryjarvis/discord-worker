/**
 * Command Registry
 *
 * - Discoverability: All commands registered here
 * - Extensibility: Add new commands by importing and adding to the registry
 */
import { redditCommandHandler } from './reddit';
import { reactCommandHandler } from './react';
import { inviteCommandHandler } from './invite';
import { refreshCommandHandler } from './refresh';

export type CommandHandler = (interaction: unknown, env: unknown, deps: unknown) => Promise<Response>;

export const commandRegistry: Record<string, CommandHandler> = {
  reddit: redditCommandHandler,
  react: reactCommandHandler,
  invite: inviteCommandHandler,
  refresh: refreshCommandHandler,
  // Add new commands here
};
