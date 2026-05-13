import { RuntimeAdapter } from '../../core/index.js';

export const localRuntime: RuntimeAdapter = {
  name: 'local',
  mode: 'process',
};
