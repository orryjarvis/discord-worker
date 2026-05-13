import { RedditThread, RedditTrendingPort } from '../../commands/reddit/trending.js';

export interface RedditApiAdapterConfig {
  readonly fetchImpl?: typeof fetch;
  readonly userAgent?: string;
}

export class RedditApiAdapter implements RedditTrendingPort {
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;

  constructor(config: RedditApiAdapterConfig = {}) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.userAgent = config.userAgent ?? 'discord-worker/1.0';
  }

  async getTrendingThread(subreddit: string): Promise<RedditThread> {
    const response = await this.fetchImpl(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?limit=1&raw_json=1`, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: {
        children?: Array<{
          data?: {
            title?: string;
            subreddit?: string;
            author?: string;
            score?: number;
            num_comments?: number;
            url?: string;
            permalink?: string;
          };
        }>;
      };
    };

    const thread = payload.data?.children?.[0]?.data;
    if (!thread?.title || !thread.subreddit || !thread.author || typeof thread.score !== 'number') {
      throw new Error(`Reddit API returned no trending thread for r/${subreddit}`);
    }

    return {
      title: thread.title,
      subreddit: thread.subreddit,
      author: thread.author,
      score: thread.score,
      comments: thread.num_comments ?? 0,
      url: thread.url ?? `https://www.reddit.com${thread.permalink ?? ''}`,
      permalink: thread.permalink ?? '',
    };
  }
}
