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
import { Auth } from './auth';
import type { Env } from './types.js';

@injectable()
export class DiscordApplicationRouter {
    private router = Router();

    constructor(
        @inject(CommandLoader) private loader: CommandLoader,
        @inject(CommandFactory) private factory: CommandFactory,
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
            return new JsonResponse({
                type: InteractionResponseType.Pong,
            });
        }

        if (interaction.type === InteractionType.ApplicationCommand) {
            const commandName = interaction.data.name.toLowerCase();
            await this.loader.loadCommand(commandName);
            const command = this.factory.getCommand(commandName);
            if (command) {
                return await command.handle(interaction);
            } else {
                console.error('Unknown Command');
                return new Response('Unknown Command', { status: 400 });
            }
        }

        console.error('Unknown Interaction Type');
        return new Response('Unknown Interaction Type', { status: 400 });
    }

    async fetch(request: Request): Promise<Response> {
        return await this.router.fetch(request);
    }
}
