import { Router } from 'itty-router';
import { inject, injectable } from 'tsyringe';
import { DiscordCommandHandler, DiscordAuth } from './discord';
import { JsonApiCommandHandler } from './api';

@injectable()
export class ApplicationRouter {
    private router = Router();

    constructor(
        @inject(DiscordAuth) private discordAuth: DiscordAuth,
        @inject(DiscordCommandHandler) private discordHandler: DiscordCommandHandler,
        @inject(JsonApiCommandHandler) private jsonApiHandler: JsonApiCommandHandler,
    ) {
        this.router.get('/', this.get.bind(this));
        this.router.all('/discord', this.discordAuth.performChecks.bind(this.discordAuth));
        this.router.post('/discord', this.discordHandler.handle.bind(this.discordHandler));
        this.router.post('/api', this.jsonApiHandler.handle.bind(this.jsonApiHandler));
        this.router.all('*', () => new Response('Not Found.', { status: 404 }));
    }

    async get(): Promise<Response> {
        return Promise.resolve(new Response(`👋 from ModChamp`));
    }

    async fetch(request: Request): Promise<Response> {
        return await this.router.fetch(request);
    }
}
