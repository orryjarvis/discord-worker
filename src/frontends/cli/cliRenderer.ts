import { CommandFailure, CommandSuccess } from '../../core/effects.js';
import { RenderContext, Renderer } from '../../core/renderer.js';
import { CliTransportMessage } from './cliFrontend.js';

function formatThreadMarkdown(data: { thread: { title: string; subreddit: string; author: string; score: number; comments: number; url: string } }): string {
  const { thread } = data;
  return [
    `r/${thread.subreddit} trending thread`,
    `Title: ${thread.title}`,
    `Author: u/${thread.author}`,
    `Score: ${thread.score} | Comments: ${thread.comments}`,
    `Link: ${thread.url}`,
  ].join('\n');
}

export class CliRenderer implements Renderer<{ thread: { title: string; subreddit: string; author: string; score: number; comments: number; url: string } }, CliTransportMessage> {
  async renderSuccess(_context: RenderContext, result: CommandSuccess<{ thread: { title: string; subreddit: string; author: string; score: number; comments: number; url: string } }>): Promise<CliTransportMessage> {
    return {
      content: formatThreadMarkdown(result.data),
    };
  }

  async renderFailure(_context: RenderContext, result: CommandFailure): Promise<CliTransportMessage> {
    return {
      content: `Error [${result.error.code}]: ${result.error.message}`,
    };
  }
}
