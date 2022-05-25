import { Router } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType
} from 'discord-api-types/v10';
import { AWW_COMMAND, COMMANDS, INVITE_COMMAND, REFRESH_COMMAND } from './commands.js';
import { getCuteUrl } from './reddit.js';
import { upsertCommands } from './api.js';
import { verifySignature } from './crypto.js';

interface Env {
  DISCORD_APPLICATION_ID: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_GUILD_ID: string | undefined;
  DISCORD_TOKEN: string;
}

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

router.post('/', async (request: Request, env) => {
  const message = await request.json<any>();
  if (message.type === InteractionType.Ping) {
    console.log('Handling Ping request');
    return new JsonResponse({
      type: InteractionResponseType.Pong,
    });
  }

  if (message.type === InteractionType.ApplicationCommand) {
    // Most user commands will come as `ApplicationCommand`.
    switch (message.data.name.toLowerCase()) {
      case AWW_COMMAND.name.toLowerCase(): {
        console.log('handling cute request');
        const cuteUrl = await getCuteUrl();
        return new JsonResponse({
          type: 4,
          data: {
            content: cuteUrl,
          },
        });
      }
      case INVITE_COMMAND.name.toLowerCase(): {
        const applicationId = env.DISCORD_APPLICATION_ID;
        const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
        return new JsonResponse({
          type: 4,
          data: {
            content: INVITE_URL,
            flags: 64,
          },
        });
      }
      case REFRESH_COMMAND.name.toLowerCase(): {
        const applicationId = env.DISCORD_APPLICATION_ID;
        const token = env.DISCORD_TOKEN;
        const guildId = env.DISCORD_GUILD_ID;
        await upsertCommands(applicationId, token, COMMANDS, guildId);
        return new JsonResponse({
          type: 4,
          data: {
            content: `${guildId ? 'Server' : 'Global'} commands refreshed`
          }
        });
      }
      default:
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
      const body = await request.clone().arrayBuffer();
      const isValidRequest = verifySignature(signature, timestamp, JSON.stringify(body), env.DISCORD_PUBLIC_KEY);
      if (!isValidRequest) {
        console.error('Invalid Request');
        return new Response('Bad request signature.', { status: 401 });
      }
    }
    return router.handle(request, env);
  },
};
