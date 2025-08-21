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
// Use a more flexible handler type for registry compatibility
export type AnyCommandHandler = (interaction: unknown, env: unknown, deps: unknown) => Promise<Response>;

export const commandRegistry: Record<string, AnyCommandHandler> = {
  reddit: redditCommandHandler,
  react: reactCommandHandler,
  invite: inviteCommandHandler,
  refresh: refreshCommandHandler,
  counter: counterCommand as AnyCommandHandler,
  // Add new commands here
};
