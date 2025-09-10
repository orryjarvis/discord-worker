import { describe, it, expect } from 'vitest';
import { DiscordCommandParser } from '../../src/discord';
import '../../src/commands/reddit.js';
import { InteractionType, ApplicationCommandType, ApplicationCommandOptionType } from 'discord-api-types/v10';

describe('DiscordCommandParser', () => {
  const parser = new DiscordCommandParser();

  it('parses reddit command', () => {
    const interaction: any = {
      type: InteractionType.ApplicationCommand,
      data: {
        type: ApplicationCommandType.ChatInput,
        name: 'reddit',
        options: [
          { name: 'subreddit', type: ApplicationCommandOptionType.String, value: 'pics' },
        ],
      },
    };
  const res: any = parser.parse(interaction);
  expect(res.commandId).toBe('reddit');
  expect(res.input).toEqual({ subreddit: 'pics' });
  });

  it('throws on missing required subreddit', () => {
    const interaction: any = {
      type: InteractionType.ApplicationCommand,
      data: {
        type: ApplicationCommandType.ChatInput,
        name: 'reddit',
        options: [],
      },
    };
  expect(() => parser.parse(interaction)).toThrowError(/Validation failed/);
  });
});
