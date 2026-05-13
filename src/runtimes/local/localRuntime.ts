import { RuntimeAdapter } from '../../core/index.js';

export class LocalRuntime implements RuntimeAdapter {
  readonly name = 'local';
  readonly mode = 'process';
}
