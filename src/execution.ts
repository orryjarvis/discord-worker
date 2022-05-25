import { APIInteraction, ApplicationCommandType, InteractionType, APIApplicationCommandInteraction, APIApplicationCommandAutocompleteInteraction } from 'discord-api-types/v10';
import { Env } from './env.js';

export const executeInteraction = async (request: Request, env: Env) => {
    const interaction: APIInteraction = await request.json();
    switch (interaction.type) {
        case InteractionType.Ping: {
            return;
        }
        case InteractionType.ApplicationCommand: {
            return;
        }
        case InteractionType.ApplicationCommandAutocomplete: {
            return;
        }
        case InteractionType.MessageComponent: {
            return;
        }
        case InteractionType.ModalSubmit: {
            return;
        }
        default: {
            const _exhaustiveInteractionTypeCheck: never = interaction;
            return _exhaustiveInteractionTypeCheck;
        }
    }
}

const executeApplicationCommand = (interaction: APIApplicationCommandInteraction) => {
    switch (interaction.data.type) {
        case ApplicationCommandType.ChatInput: {
            return;
        }
        case ApplicationCommandType.Message: {
            return;
        }
        case ApplicationCommandType.User: {
            return;
        }
        default: {
            const _exhaustiveCommandType: never = interaction.data;
            return _exhaustiveCommandType;
        }
    }
}