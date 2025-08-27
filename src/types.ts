import { APIInteraction } from "discord-api-types/v10";

export interface Env {
  DISCORD_APPLICATION_ID: string;
  SIGNATURE_PUBLIC_KEY: string;
  DISCORD_TOKEN: string;
  KV: KVNamespace;
  REDDIT_APPLICATION_ID: SecretsStoreSecret;
  REDDIT_TOKEN: SecretsStoreSecret;
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
