import { inject, injectable } from "tsyringe";
import type { ICommandHandler } from "../commanding";
import { CommandLoader, CommandFactory } from "../commanding";
import { APIInteraction, InteractionResponseType, InteractionType } from "discord-api-types/v10";
import { DiscordCommandParser, JsonResponse } from "./parser";


@injectable()
export class DiscordCommandHandler implements ICommandHandler<Request, Response> {
    constructor(
        @inject(DiscordCommandParser) private parser: DiscordCommandParser,
        @inject(CommandLoader) private loader: CommandLoader,
        @inject(CommandFactory) private factory: CommandFactory,
    ) { }

    async handle(request: Request): Promise<Response> {
        const interaction: APIInteraction = await request.json();
        if (interaction.type === InteractionType.Ping) {
            return new JsonResponse({ type: InteractionResponseType.Pong });
        }

        if (interaction.type === InteractionType.ApplicationCommand) {

            const commandId = interaction.data.name;
            await this.loader.loadCommand(commandId);
            let parsed;
            try {
                parsed = this.parser.parse(interaction);
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
            const output = await command.execute((parsed as any).input ?? (parsed as any));
            return this.parser.toResponse(output);
        }

        console.error('Unknown Interaction Type');
        return new Response('Unknown Interaction Type', { status: 400 });
    }
}
