import { RuntimeAdapter } from '../../core/index.js';

export const workersRuntime: RuntimeAdapter = {
  name: 'cloudflare-workers',
  mode: 'worker',
};
