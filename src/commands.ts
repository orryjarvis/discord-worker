import { APIApplicationCommand, ApplicationCommandOptionType, ApplicationCommandType } from 'discord-api-types/v10';

export type ApplicationCommandStub = Omit<APIApplicationCommand, 'id' | 'version' | 'application_id' | 'default_member_permissions'>;

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

export const REACT_COMMAND: ApplicationCommandStub = {
    name: 'react',
    description: 'React and track emotions',
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'emote',
            description: 'Choose an emote',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                {
                    name: 'sadge',
                    value: 'sadge'
                },
                {
                    name: 'pog',
                    value: 'pog'
                },
                {
                    name: 'weirdge',
                    value: 'weirdge'
                },
                {
                    name: 'monak',
                    value: 'monak'
                },
                {
                    name: 'jebait',
                    value: 'jebait'
                },
                {
                    name: 'kappa',
                    value: 'kappa'
                }
            ]
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

export const COUNTER_COMMAND: ApplicationCommandStub = {
    name: 'counter',
    description: 'Get hero counters for Dota 2. Example: /counter phantom lancer',
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'hero',
            description: 'The Dota 2 hero to counter',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ]
};

export const COMMANDS = [REDDIT_COMMAND, INVITE_COMMAND, REFRESH_COMMAND, REACT_COMMAND, COUNTER_COMMAND];