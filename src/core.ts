import type { Ai } from '@cloudflare/workers-types';

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
  userId: string | null;
  channelId: string | null;
  targetId: string | number | boolean | null;
  targetMessageContent: string | null;
  targetMessageAuthorId: string | null;
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
  fields: Record<string, string>;
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
  inputs: Array<{
    inputId: string;
    inputLabel: string;
    inputPlaceholder: string;
    inputMinLength: number;
    inputMaxLength: number;
    inputRequired: boolean;
    inputStyle: 'short' | 'paragraph';
  }>;
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
};

export interface FollowUpRenderHints {
  replyToMessageId?: string;
  quotedSourceText?: string;
  quotedSourceAuthorId?: string;
  quotedFallbackPrefix?: string;
}

export interface FollowUpExecutionResult {
  content: string;
  renderHints?: FollowUpRenderHints;
}

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

export type AckAndEnqueueTaskResult = {
  kind: 'ack-and-enqueue-task';
  content: string;
  task: FollowUpTask;
  ephemeral: boolean;
  delaySeconds?: number;
};

export type AckAndScheduleTaskResult = {
  kind: 'ack-and-schedule-task';
  content: string;
  task: FollowUpTask;
  ephemeral: boolean;
  delaySeconds: number;
};

export type ChannelMessageResult = {
  kind: 'channel-message';
  content: string;
  ephemeral: boolean;
};

export type CommandResult =
  | DeferFollowUpResult
  | ShowModalResult
  | SaveSubmissionResult
  | EnqueueFollowUpResult
  | AckAndEnqueueTaskResult
  | AckAndScheduleTaskResult
  | ChannelMessageResult;

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
