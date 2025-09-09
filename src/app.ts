import { Router } from 'itty-router';
import { inject, injectable } from 'tsyringe';
import {
    InteractionResponseType,
    InteractionType,
    APIInteraction
} from 'discord-api-types/v10';
import 'reflect-metadata';
import { Auth } from './auth';
import type { Env } from './types.js';
import { DiscordCommandHandler, JsonResponse } from './discord';

@injectable()
export class DiscordApplicationRouter {
    private router = Router();

    constructor(
        @inject(Auth) private auth: Auth,
        @inject('Env') private env: Env,
        @inject(DiscordCommandHandler) private handler: DiscordCommandHandler
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
            return await this.handler.handle(interaction);
        }

        console.error('Unknown Interaction Type');
        return new Response('Unknown Interaction Type', { status: 400 });
    }

    async fetch(request: Request): Promise<Response> {
        return await this.router.fetch(request);
    }
}
