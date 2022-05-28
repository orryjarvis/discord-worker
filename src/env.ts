export interface Env {
    DISCORD_APPLICATION_ID: string;
    DISCORD_PUBLIC_KEY: string;
    DISCORD_GUILD_ID: string | undefined;
    DISCORD_TOKEN: string;
    KV: KVNamespace;
}