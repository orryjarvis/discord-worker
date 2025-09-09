import { inject, injectable } from 'tsyringe';
import { ICommand, ICommandInput, ICommandOutput } from '../commanding';
import { Slash } from '../commanding/decorators';
import { RedditService } from '../services/redditService';
import { z } from 'zod';

const RedditCommandInputSchema = z.object({
  subreddit: z
    .preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(1))
    .describe('The subreddit to get media from'),
});
type RedditCommandInput = z.infer<typeof RedditCommandInputSchema> & ICommandInput;

const RedditCommandOutputSchema = z.object({
  url: z.string().url(),
});
type RedditCommandOutput = z.infer<typeof RedditCommandOutputSchema> & ICommandOutput;

@Slash({
  name: 'reddit',
  description: 'Drop some media from a subreddit.',
  input: RedditCommandInputSchema,
  output: RedditCommandOutputSchema,
})
@injectable({ token: 'ICommandHandler' })
export class RedditCommand implements ICommand {
  readonly commandId = 'reddit';
  constructor(@inject(RedditService) private redditService: RedditService) {}

  async execute(input: RedditCommandInput): Promise<RedditCommandOutput> {
    const url = await this.redditService.getMedia(input.subreddit);
    return { url };
  }
}
