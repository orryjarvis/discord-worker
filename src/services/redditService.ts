/**
 * Reddit Service
 * Encapsulates all Reddit API calls
 */
export const redditService = {
  async getMedia(subreddit: string): Promise<string> {
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json`, {
      headers: {
        'User-Agent': 'discord-worker:1.0.0 (by /u/twiitchz)',
      },
    });
    const data: any = await response.json();
    const posts = data.data.children
      .map((post: any) => {
        if (post.is_gallery) {
          return '';
        }
        return (
          post.data?.media?.reddit_video?.fallback_url ||
          post.data?.secure_media?.reddit_video?.fallback_url ||
          post.data?.url
        );
      })
      .filter((post: any) => !!post);
    const randomIndex = Math.floor(Math.random() * posts.length);
    const randomPost = posts[randomIndex];
    return randomPost;
  },
};
