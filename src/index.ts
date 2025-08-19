import { Router } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  APIInteraction,
  ApplicationCommandType,
  ApplicationCommandOptionType
} from 'discord-api-types/v10';
import { COMMANDS, INVITE_COMMAND, REACT_COMMAND, REDDIT_COMMAND, REFRESH_COMMAND } from './commands.js';
import { getRedditMedia } from './reddit.js';
import { upsertCommands } from './api.js';
import { Env } from './env.js'
import { verifySignature } from './crypto.js';
import { react } from './react.js';

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

function createCommandHandlers(deps: {
  getRedditMedia: typeof getRedditMedia,
  react: typeof react,
  upsertCommands: typeof upsertCommands,
}) {
  return {
    [REDDIT_COMMAND.name.toLowerCase()]: async (interaction, env) => {
      if (interaction.data.type === ApplicationCommandType.ChatInput) {
        const option = interaction.data.options?.find(p => p.name === 'subreddit');
        if (option?.type === ApplicationCommandOptionType.String) {
          const url = await deps.getRedditMedia(option.value);
          return new JsonResponse({
            type: 4,
            data: { content: url },
          });
        }
      }
      return new Response('Unknown Type', { status: 400 });
    },
    [REACT_COMMAND.name.toLowerCase()]: async (interaction, env) => {
      if (interaction.data.type == ApplicationCommandType.ChatInput) {
        const option = interaction.data.options?.find(p => p.name === 'emote');
        if (option?.type === ApplicationCommandOptionType.String) {
          const val = await deps.react(option.value, env);
          return new JsonResponse({
            type: 4,
            data: { content: `Reacted ${option.value} for the ${val} time` },
          });
        }
      }
      return new Response('Unknown Type', { status: 400 });
    },
    [INVITE_COMMAND.name.toLowerCase()]: async (interaction, env) => {
      const applicationId = env.DISCORD_APPLICATION_ID;
      const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
      return new JsonResponse({
        type: 4,
        data: { content: INVITE_URL, flags: 64 },
      });
    },
    [REFRESH_COMMAND.name.toLowerCase()]: async (interaction, env) => {
      const applicationId = env.DISCORD_APPLICATION_ID;
      const token = env.DISCORD_TOKEN;
      const guildId = env.DISCORD_GUILD_ID;
      await deps.upsertCommands(applicationId, token, COMMANDS, guildId);
      return new JsonResponse({
        type: 4,
        data: { content: `${guildId ? 'Server' : 'Global'} commands refreshed` },
      });
    },
  };
}

const commandHandlers = createCommandHandlers({ getRedditMedia, react, upsertCommands });

router.post('/', async (request: Request, env: Env) => {
  const interaction: APIInteraction = await request.json();
  if (interaction.type === InteractionType.Ping) {
    return new JsonResponse({
      type: InteractionResponseType.Pong,
    });
  }

  if (interaction.type === InteractionType.ApplicationCommand) {
    const commandName = interaction.data.name.toLowerCase();
    const handler = commandHandlers[commandName];
    if (handler) {
      return await handler(interaction, env);
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
