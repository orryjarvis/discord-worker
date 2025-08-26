import { APIInteraction } from "discord-api-types/v10";

export interface Env {
  DISCORD_APPLICATION_ID: string;
  SIGNATURE_PUBLIC_KEY: string;
  DISCORD_GUILD_ID: string | undefined;
  DISCORD_TOKEN: string;
  KV: KVNamespace;
  SKIP_SIGNATURE_CHECK?: string;
  REDDIT_APPLICATION_ID: string;
  REDDIT_TOKEN: string;
  DISCORD_API_BASE?: string;
  DRY_RUN_FOLLOWUPS?: string; // 'true' to avoid hitting real Discord in smoke
  FOLLOWUP_MIRROR_URL?: string; // optional endpoint to mirror follow-up payloads for smoke tests
  // Stubs for upcoming queue + service binding migration
  FOLLOWUP_QUEUE?: QueueBinding;
  DISCORD_SERVICE?: ServiceBinding;
}

export interface ICommandHandler {
  commandId: string;
  handle(interaction: APIInteraction, ctx?: ExecutionContext): Promise<Response>;
}

export class JsonResponse extends Response {
  constructor(body: Record<string, unknown>, init?: RequestInit | Request) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

// Minimal binding types to avoid pulling workers-types immediately
export type QueueBinding = {
  send: (message: unknown) => Promise<void>;
};

export type ServiceBinding = {
  fetch: (input: Request | string, init?: RequestInit) => Promise<Response>;
};
