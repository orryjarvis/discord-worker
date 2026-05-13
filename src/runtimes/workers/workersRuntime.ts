import { RuntimeAdapter } from '../../core/index.js';

export class WorkersRuntime implements RuntimeAdapter {
  readonly name = 'cloudflare-workers';
  readonly mode = 'worker';
}
