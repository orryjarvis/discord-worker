import { inject, injectable } from 'tsyringe';
import type { CommandResult } from '../commanding/contracts.js';
import { RedditService } from '../services/redditService.js';

export type RedditInput = { subreddit: string };

@injectable()
export class RedditGetMedia {
  constructor(@inject(RedditService) private redditService: RedditService) {}

  async execute(input: RedditInput): Promise<CommandResult> {
    const url = await this.redditService.getMedia(input.subreddit);
    return { kind: 'content', text: url };
  }
}
