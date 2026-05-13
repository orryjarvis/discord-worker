import { CommandDefinition, CommandHandler, createCommandFailure } from '../../core/index.js';

export interface RedditThread {
  readonly title: string;
  readonly subreddit: string;
  readonly author: string;
  readonly score: number;
  readonly comments: number;
  readonly url: string;
  readonly permalink: string;
}

export interface RedditTrendingPort {
  getTrendingThread(subreddit: string): Promise<RedditThread>;
}

export interface RedditTrendingDependencies {
  readonly reddit: RedditTrendingPort;
}

export interface RedditTrendingInput {
  readonly subreddit: string;
}

export interface RedditTrendingOutput {
  readonly thread: RedditThread;
}

class RedditTrendingHandler implements CommandHandler<RedditTrendingInput, RedditTrendingOutput> {
  constructor(private readonly dependencies: RedditTrendingDependencies) {}

  async execute(context: import('../../core/index.js').CommandContext<RedditTrendingInput>): Promise<import('../../core/index.js').CommandResult<RedditTrendingOutput>> {
    const { subreddit } = context.input;

    if (!subreddit) {
      return {
        ok: false,
        error: createCommandFailure('missing_subreddit', 'Please provide a subreddit name.'),
      };
    }

    const thread = await this.dependencies.reddit.getTrendingThread(subreddit);

    return {
      ok: true,
      data: { thread },
      effects: [
        {
          type: 'log',
          level: 'info',
          message: 'reddit trending thread resolved',
          metadata: { subreddit, score: thread.score },
        },
      ],
    };
  }
}

export function createRedditTrendingCommand(dependencies: RedditTrendingDependencies): CommandDefinition<RedditTrendingDependencies, RedditTrendingInput, RedditTrendingOutput> {
  return {
    path: ['reddit', 'trending'],
    description: 'Show the currently trending thread for a subreddit.',
    usage: 'reddit trending <subreddit>',
    defer: false,
    parse(envelope) {
      if (envelope.path[0] !== 'reddit' || envelope.path[1] !== 'trending') {
        return null;
      }

      const subreddit = envelope.args[0] ?? '';
      if (!subreddit) {
        return { subreddit: '' };
      }

      return { subreddit };
    },
    createHandler() {
      return new RedditTrendingHandler(dependencies);
    },
  };
}
