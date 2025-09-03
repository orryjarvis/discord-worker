import { 
    APIInteraction, 
    InteractionType, 
    ApplicationCommandType, 
    APIApplicationCommandInteractionDataOption,
    ApplicationCommandOptionType,
    NameplatePalette
} from "discord-api-types/v10";
import type { ICommandParser } from "../parser";
import { Interaction, InteractionResponse } from "../contracts";

export class DiscordParser implements ICommandParser<APIInteraction, Response> {
    parse(interaction: APIInteraction): Interaction {
        switch (interaction.type) {
            case InteractionType.ApplicationCommand:
                switch (interaction.data.type) {
                    case ApplicationCommandType.ChatInput:
                        return {
                            commandId: interaction.data.name,
                            input: interaction.data.options?.map(o => this._parseOption(o))
                        }
                    case ApplicationCommandType.Message:
                    case ApplicationCommandType.PrimaryEntryPoint:
                    case ApplicationCommandType.User:
                        throw new Error("Command Type not implemented");
                }
            case InteractionType.Ping:
            case InteractionType.MessageComponent:
            case InteractionType.ApplicationCommandAutocomplete:
            case InteractionType.ModalSubmit:
                throw new Error("Interaction Type not implemented");
        }
    }

    _parseOption(option: APIApplicationCommandInteractionDataOption): Record<NameplatePalette, unknown>{
        switch (option.type) {
            case ApplicationCommandOptionType.User:
            case ApplicationCommandOptionType.Attachment:
            case ApplicationCommandOptionType.Boolean:
            case ApplicationCommandOptionType.Channel:
            case ApplicationCommandOptionType.Integer:
            case ApplicationCommandOptionType.Mentionable:
            case ApplicationCommandOptionType.Number:
            case ApplicationCommandOptionType.Role:
            case ApplicationCommandOptionType.String:
            case ApplicationCommandOptionType.Subcommand:
            case ApplicationCommandOptionType.SubcommandGroup:
                throw new Error("Option type not implemented");
        }
    }

    toResponse(result: InteractionResponse): Response {
        throw new Error("Method not implemented.");
    }

}
