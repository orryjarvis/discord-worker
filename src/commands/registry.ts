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
import { counterCommand } from './counter';

export type CommandHandler = (interaction: any, env: any, deps: any) => Promise<Response>;

export const commandRegistry: Record<string, CommandHandler> = {
  reddit: redditCommandHandler,
  react: reactCommandHandler,
  invite: inviteCommandHandler,
  refresh: refreshCommandHandler,
  counter: counterCommand,
  // Add new commands here
};
