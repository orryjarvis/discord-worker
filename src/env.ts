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

