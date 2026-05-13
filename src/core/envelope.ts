export interface FrontendCapabilities {
  readonly canAcknowledge: boolean;
  readonly canFollowUp: boolean;
  readonly canEditOriginal: boolean;
  readonly supportsMarkdown: boolean;
}

export interface FrontendIdentity {
  readonly name: string;
  readonly mode: string;
}

export interface RuntimeIdentity {
  readonly name: string;
  readonly mode: string;
}

export interface CommandEnvelope<TRawEvent = unknown> {
  readonly id: string;
  readonly path: readonly string[];
  readonly args: readonly string[];
  readonly source: FrontendIdentity;
  readonly runtime: RuntimeIdentity;
  readonly rawEvent: TRawEvent;
  readonly sessionKey: string;
  readonly receivedAt: string;
  readonly capabilities: FrontendCapabilities;
  readonly metadata: Record<string, string | number | boolean>;
}
