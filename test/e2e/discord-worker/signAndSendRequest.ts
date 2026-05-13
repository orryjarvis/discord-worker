type SetupModule = {
  signAndSendRequest: (body: object) => Promise<Response>;
};

const setupChoice = (process.env.TEST_SETUP ?? 'e2e').toLowerCase();
const setupPath = setupChoice === 'smoke' ? './setup.smoke.js' : './setup.e2e.js';
const setupModulePromise = import(setupPath) as Promise<SetupModule>;

export async function signAndSendRequest(body: object): Promise<Response> {
  const module = await setupModulePromise;
  return module.signAndSendRequest(body);
}
