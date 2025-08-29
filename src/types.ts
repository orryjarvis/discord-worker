import { APIInteraction } from "discord-api-types/v10";

export interface Env {
  KV: KVNamespace;
  SIGNATURE_PUBLIC_KEY: string;

  // Integrations
  DISCORD_APPLICATION_ID: string;
  DISCORD_TOKEN: string;
  DISCORD_URL: string;

  REDDIT_APPLICATION_ID: SecretsStoreSecret;
  REDDIT_TOKEN: SecretsStoreSecret;
  REDDIT_URL: string;

  OPENDOTA_URL: string;
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
