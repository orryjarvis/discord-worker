import { etc, verifyAsync } from '@noble/ed25519';
import { CommandEnvelope, FrontendCapabilities } from '../../core/index.js';
import { Responder } from '../../core/responder.js';

export interface DiscordWorkerInput {
  readonly request: Request;
  readonly env: DiscordWorkerEnv;
  readonly interaction?: DiscordInteractionPayload;
  readonly bodyText?: string;
}

export interface DiscordWorkerEnv {
  readonly DISCORD_APPLICATION_ID: string;
  readonly DISCORD_TOKEN: string;
  readonly SIGNATURE_PUBLIC_KEY: string;
}

export interface DiscordTransportMessage {
  readonly content: string;
  readonly ephemeral?: boolean;
}

interface DiscordInteractionPayload {
  readonly type: number;
  readonly data?: {
    readonly name?: string;
    readonly options?: Array<{ readonly name?: string; readonly value?: string }>;
  };
  readonly token?: string;
  readonly id?: string;
}

const DISCORD_DEFERRED_CHANNEL_MESSAGE = 5;
const DISCORD_CHANNEL_MESSAGE_WITH_SOURCE = 4;
const DISCORD_MESSAGE_FLAGS_EPHEMERAL = 1 << 6;

class DiscordResponder implements Responder<DiscordTransportMessage, Response> {
  private acked = false;
  private replyPayload: DiscordTransportMessage = { content: '' };

  constructor(
    private readonly env: DiscordWorkerEnv,
    private readonly interaction: DiscordInteractionPayload,
  ) {}

  async ack(): Promise<void> {
    this.acked = true;
  }

  async reply(message: DiscordTransportMessage): Promise<void> {
    this.replyPayload = message;
    if (this.acked && this.interaction.token) {
      await fetch(`https://discord.com/api/v10/webhooks/${this.env.DISCORD_APPLICATION_ID}/${this.interaction.token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${this.env.DISCORD_TOKEN}`,
        },
        body: JSON.stringify({
          content: message.content,
          flags: message.ephemeral ? DISCORD_MESSAGE_FLAGS_EPHEMERAL : undefined,
        }),
      });
    }
  }

  async followUp(message: DiscordTransportMessage): Promise<void> {
    if (!this.interaction.token) {
      return;
    }

    await fetch(`https://discord.com/api/v10/webhooks/${this.env.DISCORD_APPLICATION_ID}/${this.interaction.token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${this.env.DISCORD_TOKEN}`,
      },
      body: JSON.stringify({
        content: message.content,
        flags: message.ephemeral ? DISCORD_MESSAGE_FLAGS_EPHEMERAL : undefined,
      }),
    });
  }

  async finish(): Promise<Response> {
    if (this.acked) {
      return new Response(JSON.stringify({ type: DISCORD_DEFERRED_CHANNEL_MESSAGE }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        type: DISCORD_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: this.replyPayload.content,
          flags: this.replyPayload.ephemeral ? DISCORD_MESSAGE_FLAGS_EPHEMERAL : undefined,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export class DiscordFrontend {
  readonly name = 'discord';
  readonly capabilities: FrontendCapabilities = {
    canAcknowledge: true,
    canFollowUp: true,
    canEditOriginal: false,
    supportsMarkdown: true,
  };

  constructor(private readonly env: DiscordWorkerEnv) {}

  async normalize(rawEvent: DiscordWorkerInput): Promise<CommandEnvelope<DiscordWorkerInput> | null> {
    const { request } = rawEvent;
    const body = await request.clone().text();
    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');

    if (!signature || !timestamp) {
      return null;
    }

    const verified = await verifyAsync(
      etc.hexToBytes(signature),
      new TextEncoder().encode(timestamp + body),
      etc.hexToBytes(this.env.SIGNATURE_PUBLIC_KEY),
    );

    if (!verified) {
      return null;
    }

    const interaction = JSON.parse(body) as DiscordInteractionPayload & {
      readonly type?: number;
      readonly data?: { readonly options?: Array<{ readonly name?: string; readonly value?: string }> };
    };

    if (interaction.type === 1) {
      return {
        id: interaction.id ?? `discord-${Date.now()}`,
        path: ['discord', 'ping'],
        args: [],
        source: { name: this.name, mode: 'worker' },
        runtime: { name: 'cloudflare-workers', mode: 'worker' },
        rawEvent: {
          ...rawEvent,
          interaction,
          bodyText: body,
        },
        sessionKey: `discord:ping:${interaction.id ?? 'unknown'}`,
        receivedAt: new Date().toISOString(),
        capabilities: this.capabilities,
        metadata: {
          interactionType: interaction.type,
        },
      };
    }

    const commandName = interaction.data?.name ?? 'unknown';
    const options = interaction.data?.options ?? [];
    const subreddit = options.find((option) => option.name === 'subreddit')?.value ?? '';

    return {
      id: interaction.id ?? `discord-${Date.now()}`,
      path: ['reddit', 'trending'],
      args: [subreddit],
      source: { name: this.name, mode: 'worker' },
      runtime: { name: 'cloudflare-workers', mode: 'worker' },
      rawEvent: {
        ...rawEvent,
        request,
        env: this.env,
        interaction,
        bodyText: body,
      },
      sessionKey: `discord:${commandName}:${interaction.id ?? 'unknown'}`,
      receivedAt: new Date().toISOString(),
      capabilities: this.capabilities,
      metadata: {
        commandName,
      },
    };
  }

  createResponder(envelope: CommandEnvelope<DiscordWorkerInput>): Responder<DiscordTransportMessage, Response> {
    const interaction = envelope.rawEvent.interaction ?? { type: 0 };
    return new DiscordResponder(this.env, interaction);
  }
}
