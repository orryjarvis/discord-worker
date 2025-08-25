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
