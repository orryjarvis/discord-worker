import { APIInteraction } from "discord-api-types/v10";

export interface Env {
  DISCORD_APPLICATION_ID: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_GUILD_ID: string | undefined;
  DISCORD_TOKEN: string;
  KV: KVNamespace;
  SKIP_SIGNATURE_CHECK?: string;
  REDDIT_APPLICATION_ID: string;
  REDDIT_TOKEN: string;
}

export interface ICommandHandler {
  commandId: string;
  handle(interaction: APIInteraction): Promise<Response>;
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
