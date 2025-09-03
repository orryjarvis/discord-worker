import { Interaction, InteractionResponse } from "./contracts";

export interface ICommandHandler {
  commandId: string;
  handle(interaction: Interaction): Promise<InteractionResponse>;
}
