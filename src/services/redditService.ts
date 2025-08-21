import { injectable } from 'tsyringe';
import type { RedditApiResponse } from '../types/commandTypes';

@injectable()
export class RedditService {
  async getMedia(subreddit: string): Promise<string> {
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json`, {
      headers: {
        'User-Agent': 'discord-worker:1.0.0 (by /u/twiitchz)',
      },
    });
    const data = await response.json() as RedditApiResponse;
    const posts = data.data.children
      .map((post) => {
        if (post.is_gallery) {
          return '';
        }
        return (
          post.data?.media?.reddit_video?.fallback_url ||
          post.data?.secure_media?.reddit_video?.fallback_url ||
          post.data?.url || ''
        );
      })
      .filter((post) => post !== '');
    const randomIndex = Math.floor(Math.random() * posts.length);
    const randomPost = posts[randomIndex] ?? '';
    return randomPost;
  }
}
