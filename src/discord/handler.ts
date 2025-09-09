import { inject } from "tsyringe";
import type { ICommandHandler } from "../commanding";
import { CommandLoader, CommandFactory } from "../commanding";
import { APIApplicationCommandInteraction, InteractionResponseType } from "discord-api-types/v10";
import { DiscordCommandParser, JsonResponse } from "./parser";


export class DiscordCommandHandler implements ICommandHandler<APIApplicationCommandInteraction, Response> {
    constructor(
        @inject(DiscordCommandParser) private parser: DiscordCommandParser,
        @inject(CommandLoader) private loader: CommandLoader,
        @inject(CommandFactory) private factory: CommandFactory,
    ) { }

    async handle(interactionRequest: APIApplicationCommandInteraction): Promise<Response> {
        const commandId = interactionRequest.data.name;
        await this.loader.loadCommand(commandId);
        let input;
        try {
            input = this.parser.parse(interactionRequest);
        } catch (err: any) {
            const message = err?.message || 'Validation failed';
            return new JsonResponse({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: { content: message },
            });
        }
        const command = this.factory.getCommand(commandId);
        if (!command) {
            console.error('Unknown Command');
            return new Response('Unknown Command', { status: 400 });
        }
        const output = await command.execute(input);
        return this.parser.toResponse(output);
    }
}
