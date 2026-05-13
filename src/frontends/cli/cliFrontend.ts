import { CommandEnvelope, FrontendCapabilities } from '../../core/index.js';
import { Responder } from '../../core/responder.js';

export interface CliInvocation {
  readonly argv: readonly string[];
}

export interface CliTransportMessage {
  readonly content: string;
}

class CliResponder implements Responder<CliTransportMessage, string> {
  private message: CliTransportMessage = { content: '' };

  async ack(): Promise<void> {
    return undefined;
  }

  async reply(message: CliTransportMessage): Promise<void> {
    this.message = message;
  }

  async followUp(message: CliTransportMessage): Promise<void> {
    this.message = {
      content: `${this.message.content}\n${message.content}`.trim(),
    };
  }

  async finish(): Promise<string> {
    return this.message.content;
  }
}

export class CliFrontend {
  readonly name = 'cli';
  readonly capabilities: FrontendCapabilities = {
    canAcknowledge: false,
    canFollowUp: false,
    canEditOriginal: false,
    supportsMarkdown: false,
  };

  async normalize(rawEvent: CliInvocation): Promise<CommandEnvelope<CliInvocation> | null> {
    const [command, subcommand, ...args] = rawEvent.argv;
    if (!command) {
      return null;
    }

    return {
      id: `cli-${Date.now()}`,
      path: subcommand ? [command, subcommand] : [command],
      args: subcommand ? args : rawEvent.argv.slice(1),
      source: { name: this.name, mode: 'local' },
      runtime: { name: 'local', mode: 'process' },
      rawEvent,
      sessionKey: `cli:${command}:${subcommand ?? 'root'}`,
      receivedAt: new Date().toISOString(),
      capabilities: this.capabilities,
      metadata: {
        command,
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createResponder(envelope: CommandEnvelope<CliInvocation>): Responder<CliTransportMessage, string> {
    return new CliResponder();
  }
}

export function createCliMessage(content: string): CliTransportMessage {
  return { content };
}
