// This file is a module augmentation. The empty export makes it a module.
export {};

declare global {
  namespace Cloudflare {
    interface Env {
      // Injected by globalSetup — base URL of the Node mock server.
      MOCK_SERVER_BASE_URL: string;
    }
  }
}

