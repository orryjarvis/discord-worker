import { RuntimeAdapter } from '@/core/index';

export const workersRuntime: RuntimeAdapter = {
  name: 'cloudflare-workers',
  mode: 'worker',
};
