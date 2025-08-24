import { describe, it, expect } from 'vitest';
import "../setup";
import { RedditCommand } from '../../src/commands/reddit';
import { createEnv, createMockRedditService } from '../setup';

describe('Reddit Command', () => {
  it('returns top posts from subreddit', async () => {
    const interaction = {
      data: {
        type: 1, // ApplicationCommandType.ChatInput
        options: [{ name: 'subreddit', value: 'test', type: 3 }], // type: ApplicationCommandOptionType.String
      }
    };
    const env = createEnv();
    const redditService = createMockRedditService();
    const command = new RedditCommand(redditService);
    const res = await command.handle(interaction, env);
  expect(redditService.getMedia).toHaveBeenCalledWith('test');
  expect(res.status).toBe(200);
  const json = await res.json() as any;
  expect(typeof json.data.content).toBe('string');
  });
});
