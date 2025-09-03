export type Interaction = {
  commandId: string;
  input: Record<string, unknown>;
};

export type ContentResponse = { kind: 'content'; text: string; ephemeral?: boolean };
export type EmbedField = { name: string; value: string; inline?: boolean };
export type EmbedResponse = { kind: 'embed'; title?: string; description?: string; fields?: EmbedField[]; ephemeral?: boolean };
export type DeferredResponse = { kind: 'deferred'; ephemeral?: boolean };
export type InteractionResponse = ContentResponse | EmbedResponse | DeferredResponse;

