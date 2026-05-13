export interface ThreadSummaryData {
  readonly title: string;
  readonly subreddit: string;
  readonly author: string;
  readonly score: number;
  readonly comments: number;
  readonly url: string;
}

export function formatThreadSummary(thread: ThreadSummaryData): string {
  return [
    `r/${thread.subreddit} trending thread`,
    `Title: ${thread.title}`,
    `Author: u/${thread.author}`,
    `Score: ${thread.score} | Comments: ${thread.comments}`,
    `Link: ${thread.url}`,
  ].join('\n');
}
