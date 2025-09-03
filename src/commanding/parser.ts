import type { Interaction, InteractionResponse } from './contracts.js';

export interface ICommandParser<TInteraction, TResponse> {
  parse(interaction: TInteraction): Interaction;
  toResponse(result: InteractionResponse): TResponse;
}
