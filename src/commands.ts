export interface Command {
    name: string;
    description: string;
}

export const AWW_COMMAND: Command = {
    name: 'awwww',
    description: 'Drop some cuteness on this channel.'
}

export const INVITE_COMMAND: Command = {
    name: 'invite',
    description: 'Get an invite link to add the bot to your server',
};

export const COMMANDS = [AWW_COMMAND, INVITE_COMMAND];