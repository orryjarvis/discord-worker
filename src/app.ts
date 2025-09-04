import { Router } from 'itty-router';
import { inject, injectable } from 'tsyringe';
import { JsonResponse } from './types';
import {
    InteractionResponseType,
    InteractionType,
    APIInteraction
} from 'discord-api-types/v10';
import 'reflect-metadata';
import { CommandLoader } from './loader';
import { CommandFactory } from './factory';
import { DiscordCommandParser } from './commanding/discord/discordCommandParser';
import { Auth } from './auth';
import type { Env } from './types.js';

@injectable()
export class DiscordApplicationRouter {
    private router = Router();

    constructor(
        @inject(CommandLoader) private loader: CommandLoader,
        @inject(CommandFactory) private factory: CommandFactory,
        @inject(DiscordCommandParser) private parser: DiscordCommandParser,
        @inject(Auth) private auth: Auth,
        @inject('Env') private env: Env
    ) {
        this.router.get('/', this.get.bind(this));
        this.router.all('*', this.auth.performChecks.bind(this.auth));
        this.router.post('/', this.post.bind(this));
        this.router.all('*', () => new Response('Not Found.', { status: 404 }));
    }

    async get(): Promise<Response> {
        return Promise.resolve(new Response(`👋 ${this.env.DISCORD_APPLICATION_ID}`));
    }

    async post(request: Request): Promise<Response> {
        const interaction: APIInteraction = await request.json();
        if (interaction.type === InteractionType.Ping) {
            return new JsonResponse({ type: InteractionResponseType.Pong });
        }

        if (interaction.type === InteractionType.ApplicationCommand) {
            // Parse once to get the command id even if schema isn't registered yet
            let preParsed: { commandId: string };
            try {
                preParsed = this.parser.parse(interaction);
            } catch (err) {
                console.error('Unsupported or malformed interaction:', err);
                return new Response('Unsupported or malformed interaction', { status: 400 });
            }

            // Dynamically load command so decorators register schemas
            await this.loader.loadCommand(preParsed.commandId);

            // Parse again to validate and cast per registered schema
            let parsed: any;
            try {
                parsed = this.parser.parse(interaction);
            } catch (err: any) {
                const message = err?.message || 'Validation failed';
                return new JsonResponse({
                    type: InteractionResponseType.ChannelMessageWithSource,
                    data: { content: message },
                });
            }

            const command = this.factory.getCommand(parsed.commandId);
            if (!command) {
                console.error('Unknown Command');
                return new Response('Unknown Command', { status: 400 });
            }

            const result = await (command as any).handle(parsed.input);
            if (result instanceof Response) return result;

            // Map simple object results to a Discord content message.
            let content: string;
            if (result && typeof result === 'object' && 'url' in result && typeof (result as any).url === 'string') {
                content = (result as any).url as string;
            } else if (typeof result === 'string') {
                content = result;
            } else {
                content = JSON.stringify(result ?? {});
            }

            return new JsonResponse({
                type: InteractionResponseType.ChannelMessageWithSource,
                data: { content },
            });
        }

        console.error('Unknown Interaction Type');
        return new Response('Unknown Interaction Type', { status: 400 });
    }

    async fetch(request: Request): Promise<Response> {
        return await this.router.fetch(request);
    }
}
