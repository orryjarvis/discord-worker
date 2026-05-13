export function createId(prefix: string): string {
  const runtimeCrypto = globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } };
  const random = runtimeCrypto.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}
