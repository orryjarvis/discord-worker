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
import { Configuration } from './config';
import { ObjectStorage } from './services/objectStorage';

@injectable()
export class DiscordApplicationRouter {
    private router = Router();
    private ctx?: ExecutionContext;

    constructor(
        @inject(CommandLoader) private loader: CommandLoader,
        @inject(CommandFactory) private factory: CommandFactory,
        @inject(Auth) private auth: Auth,
        @inject(Configuration) private config: Configuration,
        @inject(ObjectStorage) private kv: ObjectStorage,
    ) {
        this.router.get('/', this.get.bind(this));
        // Test mirror endpoints (before auth), guarded via env flag
        const enableTestMirror = String(this.config.get('ENABLE_TEST_MIRROR') || '').toLowerCase() === 'true';
        if (enableTestMirror) {
            this.router.post('/_test/mirror', this.mirrorPost.bind(this));
            this.router.get('/_test/mirror', this.mirrorGet.bind(this));
        }
        this.router.all('*', this.auth.performChecks.bind(this.auth));
    this.router.post('/', this.post.bind(this));
        this.router.all('*', () => new Response('Not Found.', { status: 404 }));
    }

    async get(): Promise<Response> {
        return Promise.resolve(new Response(`👋 ${this.config.get('DISCORD_APPLICATION_ID')}`));
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
                return await command.handle(interaction, this.ctx);
            } else {
                console.error('Unknown Command');
                return new Response('Unknown Command', { status: 400 });
            }
        }

        console.error('Unknown Interaction Type');
        return new Response('Unknown Interaction Type', { status: 400 });
    }

    async fetch(request: Request, ctx?: ExecutionContext): Promise<Response> {
        this.ctx = ctx;
        return await this.router.fetch(request);
    }

    private async mirrorPost(request: Request): Promise<Response> {
        try {
            const raw = await request.json().catch(() => ({}));
            const body = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : { value: raw };
            const key = 'events';
            const ns = 'TestMirror';
            const existing = (await this.kv.get_json(ns, key)) as any[] | null;
            const arr = Array.isArray(existing) ? existing : [];
            arr.push({ ...body, _ts: Date.now() });
            // keep last 50
            const trimmed = arr.slice(-50);
            await this.kv.put(ns, key, JSON.stringify(trimmed));
            return new JsonResponse({ ok: true });
        } catch (e) {
            return new Response('Mirror error', { status: 500 });
        }
    }

    private async mirrorGet(): Promise<Response> {
        const key = 'events';
        const ns = 'TestMirror';
        const existing = (await this.kv.get_json(ns, key)) as any[] | null;
        return new JsonResponse({ events: Array.isArray(existing) ? existing : [] });
    }
}
