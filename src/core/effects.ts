export interface CommandError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface SessionState {
  readonly id: string;
  readonly status: 'new' | 'active' | 'waiting' | 'done' | 'failed';
  readonly data: Record<string, unknown>;
  readonly updatedAt: string;
}

export type CommandEffect =
  | {
      readonly type: 'log';
      readonly level: 'debug' | 'info' | 'warn' | 'error';
      readonly message: string;
      readonly metadata?: Record<string, unknown>;
    }
  | {
      readonly type: 'session';
      readonly session: SessionState;
    };

export interface CommandSuccess<TData> {
  readonly ok: true;
  readonly data: TData;
  readonly effects?: readonly CommandEffect[];
  readonly defer?: boolean;
  readonly session?: SessionState;
}

export interface CommandFailure {
  readonly ok: false;
  readonly error: CommandError;
  readonly effects?: readonly CommandEffect[];
  readonly defer?: boolean;
  readonly session?: SessionState;
}

export type CommandResult<TData> = CommandSuccess<TData> | CommandFailure;
