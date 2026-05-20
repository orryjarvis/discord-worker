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

export type EnqueuePastifyResult = {
  kind: 'enqueue-pastify';
  token: string;
  idea: string;
};

export type CommandResult =
  | DeferFollowUpResult
  | ShowModalResult
  | SaveSubmissionResult
  | EnqueuePastifyResult;

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
