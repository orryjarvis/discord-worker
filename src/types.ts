export interface Env {
    DISCORD_APPLICATION_ID: string;
    DISCORD_PUBLIC_KEY: string;
    DISCORD_GUILD_ID: string | undefined;
    DISCORD_TOKEN: string;
    KV: KVNamespace;
    SKIP_SIGNATURE_CHECK?: string;
}

export interface ICommandHandler {
  commandId: string;
  handle(interaction: any, env: Env): Promise<Response>;
}
