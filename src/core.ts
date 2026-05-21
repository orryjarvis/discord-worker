export interface SubmissionRecord {
  interactionId: string;
  userId: string | null;
  guildId: string | null;
  channelId: string | null;
  customId: string;
  text: string;
  submittedAt: string;
}

export interface PingRequest {
  kind: 'ping';
}

export interface SlashCommandRequest {
  kind: 'command';
  commandName: string;
  token: string;
  options: Record<string, string | number | boolean>;
  targetId: string | number | boolean | null;
  targetMessageContent: string | null;
  targetMessageAuthorId: string | null;
  responseVisibility: 'public' | 'ephemeral';
}

export interface ComponentRequest {
  kind: 'component';
  commandName: string;
}

export interface ModalSubmitRequest {
  kind: 'modal-submit';
  commandName: string;
  token: string;
  interactionId: string;
  userId: string | null;
  guildId: string | null;
  channelId: string | null;
  text: string;
}

export type CommandRequest = SlashCommandRequest | ComponentRequest | ModalSubmitRequest;
export type AppRequest = PingRequest | CommandRequest;

export type DeferFollowUpResult = {
  kind: 'defer-follow-up';
  token: string;
};

export type ShowModalResult = {
  kind: 'show-modal';
  modalId: string;
  title: string;
  inputId: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputMinLength: number;
  inputMaxLength: number;
  inputRequired: boolean;
};

export type SaveSubmissionResult = {
  kind: 'save-submission';
  submission: SubmissionRecord;
  content: string;
  ephemeral: boolean;
};

export type FollowUpTask = {
  commandName: string;
  payload: Record<string, unknown>;
  responseMode?: 'edit-original' | 'create-follow-up';
};

export interface AiRuntimeEnv {
  AI: Ai;
}

export interface FollowUpExecutionContext {
  messageId: string;
  token: string;
}

export type EnqueueFollowUpResult = {
  kind: 'enqueue-follow-up';
  token: string;
  task: FollowUpTask;
  ephemeral: boolean;
};

export type CommandResult =
  | DeferFollowUpResult
  | ShowModalResult
  | SaveSubmissionResult
  | EnqueueFollowUpResult;

export type CommandHandler = (request: CommandRequest) => Promise<CommandResult> | CommandResult;

export type CommandMap = Readonly<Record<string, CommandHandler>>;

export type PongResult = {
  kind: 'pong';
};

export type DispatchError = {
  kind: 'unknown-command';
  commandName: string;
};

export type DispatchOutcome = PongResult | CommandResult | DispatchError;
