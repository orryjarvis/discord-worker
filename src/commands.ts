import { APIApplicationCommand, ApplicationCommandOptionType, ApplicationCommandType } from 'discord-api-types/v10';

export type ApplicationCommandStub = Omit<APIApplicationCommand, 'id' | 'version' | 'application_id'>;

export const REDDIT_COMMAND: ApplicationCommandStub = {
    name: 'reddit',
    description: 'Drop some media from a subreddit.',
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'subreddit',
            description: 'The subreddit to get media from',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ]
}

export const INVITE_COMMAND: ApplicationCommandStub = {
    name: 'invite',
    description: 'Get an invite link to add the bot to your server',
    type: ApplicationCommandType.ChatInput,
};

export const REFRESH_COMMAND: ApplicationCommandStub = {
    name: 'refresh',
    description: 'Refresh commands for the bot - useful for development',
    type: ApplicationCommandType.ChatInput
}

export const COMMANDS = [REDDIT_COMMAND, INVITE_COMMAND, REFRESH_COMMAND];