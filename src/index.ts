import { Router } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  APIInteraction,
} from 'discord-api-types/v10';
import { commandRegistry } from './commands/registry';
import { redditService } from './services/redditService';
import { reactService } from './services/reactService';
import { discordService } from './services/discordService';
import { COMMANDS } from './commands.js';

import { Env } from './env.js'
import { verifySignature } from './crypto.js';

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
    const handler = commandRegistry[commandName];
    if (handler) {
      // Inject shared services and COMMANDS
      const deps = {
        redditService,
        reactService,
        discordService,
        commands: COMMANDS,
      };
      return await handler(interaction, env, deps);
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
      const signature = request.headers.get('x-signature-ed25519') ?? "";
      const timestamp = request.headers.get('x-signature-timestamp') ?? "";
      const body = await request.clone().text();
      const isValidRequest = await verifySignature(signature, timestamp, body, env.DISCORD_PUBLIC_KEY);
      if (!isValidRequest) {
        console.error('Invalid Request');
        return new Response('Bad request signature.', { status: 401 });
      }
    }
    return router.handle(request, env);
  },
};

export { JsonResponse };
