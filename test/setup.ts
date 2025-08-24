// Reusable mock RedditService implementation
export function createMockRedditService() {
  return {
    getTopPosts: vi.fn(async (subreddit: string, limit: number) => [
      { title: 'Test Post', url: 'https://reddit.com/test', author: 'user1' },
    ]),
    getMedia: vi.fn(async () => ''),
    // Add other RedditService methods as needed
  };
}
// Reusable mock ReactService implementation
export function createMockReactService() {
  return {
    react: vi.fn(async (emote: string, env: any) => '1'), // returns a string for formatting
    // Add other ReactService methods as needed
  };
}
// Reusable mock DiscordService implementation
export function createMockDiscordService() {
  return {
    getInviteUrl: vi.fn((id: string) => `https://discord.gg/${id}`),
    upsertCommands: vi.fn(async () => Promise.resolve(new Response('commands refreshed'))),
    sendMessage: vi.fn(async () => Promise.resolve('sent')),
    // Add other DiscordService methods as needed
  };
}
// Global test setup for vitest
import "reflect-metadata";

// Reusable mock KV implementation
export const mockKV = {
  store: {} as Record<string, any>,
  async get(key: string) {
    return this.store[key] ? JSON.parse(this.store[key]) : null;
  },
  async put(key: string, value: string) {
    this.store[key] = value;
  },
  async list() {
    return Object.keys(this.store);
  },
  async getWithMetadata(key: string) {
    return { value: this.store[key], metadata: {} };
  },
  async delete(key: string) {
    delete this.store[key];
  },
};

// Reusable mock DotaService implementation
import { vi } from "vitest";
export function createMockDotaService() {
  return {
    kv: mockKV as unknown as KVNamespace<string>,
    getHeroIdByName: vi.fn(async (name: string) => {
      if (name === "Phantom Lancer") return 1;
      if (name === "Axe") return 2;
      if (name === "Lion") return 3;
      return null;
    }),
    getHeroCounters: vi.fn(async (heroName: string, kv: any, topN?: number) => {
      if (heroName === "Phantom Lancer") {
        return ["Lion", "Axe"];
      }
      return [];
    }),
  };
}

// Reusable env creator
export function createEnv() {
  return {
    DISCORD_APPLICATION_ID: "test-app-id",
    DISCORD_PUBLIC_KEY: "test-public-key",
    DISCORD_GUILD_ID: "test-guild-id",
    DISCORD_TOKEN: "test-token",
    KV: mockKV as unknown as KVNamespace<string>,
    kv: mockKV as unknown as KVNamespace<string>,
  };
}
