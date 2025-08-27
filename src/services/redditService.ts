import { inject, injectable } from 'tsyringe';
import type { RedditApiResponse } from '../types/commandTypes';
import type { Env } from '../types.js';

@injectable()
export class RedditService {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(@inject('Env') private env: Env) { }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 5_000) {
      return this.cachedToken.value;
    }
    const clientId = await this.env.REDDIT_APPLICATION_ID.get();
    const clientSecret = await this.env.REDDIT_TOKEN.get();

    // OAuth2 client_credentials flow for application-only access
    const authHeader = 'Basic ' + btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'discord-worker:1.0.0 (by /u/twiitchz)',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Reddit auth failed: ${tokenRes.status} ${text}`);
    }

    const tokenJson = await tokenRes.json() as { access_token: string; token_type: string; expires_in: number };
    const expiresAt = Date.now() + (tokenJson.expires_in * 1000);
    this.cachedToken = { value: tokenJson.access_token, expiresAt };
    return tokenJson.access_token;
  }

  async getMedia(subreddit: string): Promise<string> {
    const token = await this.getAccessToken();
    const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/hot.json`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'discord-worker:1.0.0 (by /u/twiitchz)',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Reddit API error: ${response.status} ${text}`);
    }

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
