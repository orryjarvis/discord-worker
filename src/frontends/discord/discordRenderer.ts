import { CommandFailure, CommandSuccess } from '@/core/effects';
import { RenderContext, Renderer } from '@/core/renderer';
import { DiscordTransportMessage } from './discordFrontend';
import { formatThreadSummary, ThreadSummaryData } from '@/commands/reddit/renderThread';

export class DiscordRenderer implements Renderer<{ thread: ThreadSummaryData }, DiscordTransportMessage> {
  async renderSuccess(_context: RenderContext, result: CommandSuccess<{ thread: ThreadSummaryData }>): Promise<DiscordTransportMessage> {
    return {
      content: formatThreadSummary(result.data.thread),
    };
  }

  async renderFailure(_context: RenderContext, result: CommandFailure): Promise<DiscordTransportMessage> {
    return {
      content: `Error [${result.error.code}]: ${result.error.message}`,
      ephemeral: true,
    };
  }
}
