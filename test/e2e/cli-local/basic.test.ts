import { describe, expect, it } from 'vitest';
import { runCliApp } from '@/../src/apps/shared/createApp';

describe('cli-local e2e', () => {
  it('executes reddit trending end-to-end through app composition', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  title: 'CLI e2e trending thread',
                  subreddit: 'javascript',
                  author: 'cli_author',
                  score: 999,
                  num_comments: 42,
                  url: 'https://www.reddit.com/r/javascript/comments/cli-e2e',
                  permalink: '/r/javascript/comments/cli-e2e',
                },
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );

    const output = await runCliApp({
      argv: ['reddit', 'trending', 'javascript'],
      fetchImpl,
    });

    expect(output).toContain('r/javascript trending thread');
    expect(output).toContain('CLI e2e trending thread');
    expect(output).toContain('u/cli_author');
  });

  it('returns a deterministic validation error for missing subreddit', async () => {
    const output = await runCliApp({
      argv: ['reddit', 'trending'],
      fetchImpl: fetch,
    });

    expect(output).toContain('Error [missing_subreddit]');
  });
});
