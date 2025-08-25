// Dynamically route signAndSendRequest to the chosen test setup.
// Select setup via process.env.TEST_SETUP = 'e2e' | 'smoke' (defaults to 'e2e').

type SetupModule = {
  // Keep the type broad to avoid cross-env Response typing issues (undici vs lib-dom).
  signAndSendRequest: (body: object) => Promise<any>;
  waitForFollowup?: (predicate: (events: any[]) => boolean, timeoutMs?: number, intervalMs?: number) => Promise<void>;
  getFollowupEvents?: () => Promise<any[] | any> | (any[] | any);
};

const setupChoice = (process.env.TEST_SETUP || 'e2e').toLowerCase();

// Use dynamic import in a way that keeps TypeScript happy and defers resolution until runtime.
const setupPath = setupChoice === 'smoke' ? './setup.smoke' : './setup.e2e';
const setupModulePromise = import(setupPath) as Promise<SetupModule>;

export async function signAndSendRequest(body: object): Promise<any> {
  const mod = await setupModulePromise;
  return mod.signAndSendRequest(body);
}

export async function waitForFollowup(
  predicate: (events: any[]) => boolean,
  timeoutMs = 7000,
  intervalMs = 150
): Promise<void> {
  const mod = await setupModulePromise as any;
  if (typeof mod.waitForFollowup === 'function') {
    return mod.waitForFollowup(predicate, timeoutMs, intervalMs);
  }
  // Fallback no-op: immediately resolve (smoke env may not support follow-up assertions)
  return Promise.resolve();
}

export async function getFollowupEvents(): Promise<any[]> {
  const mod = await setupModulePromise as any;
  if (typeof mod.getFollowupEvents === 'function') {
    const res = await mod.getFollowupEvents();
    return Array.isArray(res) ? res : (res?.events ?? []);
  }
  return [];
}
