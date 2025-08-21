import { Router } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  APIInteraction
} from 'discord-api-types/v10';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { Env } from './types.js';
import { verifySignature } from './crypto.js';
import { CounterCommand } from './commands/counter.js';
import { CommandRegistry } from './registry.js';
import { DotaService } from './services/dotaService.js';
console.log(CounterCommand)
console.log(DotaService)

const commandRegistry = container.resolve(CommandRegistry);
console.log(commandRegistry);
const handler = commandRegistry.getHandler('counter');
console.log(handler);


class JsonResponse extends Response {
  constructor(body: Record<string, unknown>, init?: RequestInit | Request) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

const router = Router();


router.get('/', async (request: Request, env: Env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.post('/', async (request: Request, env: Env) => {
  const interaction: APIInteraction = await request.json();
  if (interaction.type === InteractionType.Ping) {
    return new JsonResponse({
      type: InteractionResponseType.Pong,
    });
  }

  if (interaction.type === InteractionType.ApplicationCommand) {
    const commandName = interaction.data.name.toLowerCase();
    const commandRegistry = container.resolve(CommandRegistry);
    const handler = commandRegistry.getHandler(commandName);
    if (handler) {
      return await handler.handle(interaction, env);
    } else {
      console.error('Unknown Command');
      return new Response('Unknown Type', { status: 400 });
    }
  }

  console.error('Unknown Type');
  return new Response('Unknown Type', { status: 400 });
});

router.all('*', () => new Response('Not Found.', { status: 404 }));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'POST') {
      // Bypass signature verification for local/dev/testing
      if (env.SKIP_SIGNATURE_CHECK === 'true') {
        return router.fetch(request, env);
      }
      const signature = request.headers.get('x-signature-ed25519') ?? "";
      const timestamp = request.headers.get('x-signature-timestamp') ?? "";
      const body = await request.clone().text();
      const isValidRequest = await verifySignature(signature, timestamp, body, env.DISCORD_PUBLIC_KEY);
      if (!isValidRequest) {
        console.error('Invalid Request');
        return new Response('Bad request signature.', { status: 401 });
      }
    }
    return router.fetch(request, env);
  },
};

export { JsonResponse };
