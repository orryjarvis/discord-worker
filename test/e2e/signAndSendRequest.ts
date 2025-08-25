// Dynamically route signAndSendRequest to the chosen test setup.
// Select setup via process.env.TEST_SETUP = 'e2e' | 'smoke' (defaults to 'e2e').

type SetupModule = {
  // Keep the type broad to avoid cross-env Response typing issues (undici vs lib-dom).
  signAndSendRequest: (body: object) => Promise<any>;
};

const setupChoice = (process.env.TEST_SETUP || 'e2e').toLowerCase();

// Use dynamic import in a way that keeps TypeScript happy and defers resolution until runtime.
const setupPath = setupChoice === 'smoke' ? './setup.smoke' : './setup.e2e';
const setupModulePromise = import(setupPath) as Promise<SetupModule>;

export async function signAndSendRequest(body: object): Promise<any> {
  const mod = await setupModulePromise;
  return mod.signAndSendRequest(body);
}
