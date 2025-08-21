// Discord API Command Definition
export interface DiscordCommand {
  name: string;
  description: string;
  options?: Array<{
    name: string;
    description: string;
    type: number;
    required?: boolean;
  }>;
  type?: number;
}

// Dota Hero and Matchup Types
export interface DotaHero {
  id: number;
  localized_name: string;
}

export interface DotaMatchup {
  hero_id: number;
  wins: number;
  games_played: number;
}

export interface DotaCounter {
  hero_id: number;
  win_rate: number;
}

// Reddit API Types
export interface RedditApiResponse {
  data: {
    children: RedditPostWrapper[];
  };
}

export interface RedditPostWrapper {
  data: RedditPostData;
  is_gallery?: boolean;
}

export interface RedditPostData {
  media?: {
    reddit_video?: {
      fallback_url?: string;
    };
  };
  secure_media?: {
    reddit_video?: {
      fallback_url?: string;
    };
  };
  url?: string;
}
export interface InviteCommandDeps {
  discordService: {
    getInviteUrl: (applicationId: string) => string;
  };
}

export interface ReactCommandDeps {
  reactService: {
    react: (emote: string, env: unknown) => Promise<number>;
  };
}

export interface RedditCommandDeps {
  redditService: {
    getMedia: (subreddit: string) => Promise<string>;
  };
}

export interface RefreshCommandDeps {
  discordService: {
    upsertCommands: (applicationId: string, token: string, commands: unknown, guildId: string) => Promise<void>;
  };
  commands: unknown;
}

export type CommandHandler<TDeps = unknown> = (interaction: unknown, env: unknown, deps: TDeps) => Promise<Response>;
export interface CounterCommandDeps {
  getCount: (userId: string) => Promise<number>;
  setCount: (userId: string, count: number) => Promise<void>;
}

export interface CounterCommandArgs {
  userId: string;
  count?: number;
}
