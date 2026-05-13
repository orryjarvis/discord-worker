import { CommandFailure, CommandSuccess } from '../../core/effects.js';
import { RenderContext, Renderer } from '../../core/renderer.js';
import { CliTransportMessage } from './cliFrontend.js';
import { formatThreadSummary, ThreadSummaryData } from '../../commands/reddit/renderThread.js';

export class CliRenderer implements Renderer<{ thread: ThreadSummaryData }, CliTransportMessage> {
  async renderSuccess(_context: RenderContext, result: CommandSuccess<{ thread: ThreadSummaryData }>): Promise<CliTransportMessage> {
    return {
      content: formatThreadSummary(result.data.thread),
    };
  }

  async renderFailure(_context: RenderContext, result: CommandFailure): Promise<CliTransportMessage> {
    return {
      content: `Error [${result.error.code}]: ${result.error.message}`,
    };
  }
}
