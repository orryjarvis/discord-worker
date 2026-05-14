import { verifyDiscordRequest, jsonResponse, sleep, editOriginalInteractionResponse } from './discord.js';

interface Env {
  DISCORD_APPLICATION_ID: string;
  SIGNATURE_PUBLIC_KEY: string;
  DISCORD_TOKEN: string;
}

interface Interaction {
  type: number;
  token: string;
  data?: {
    name?: string;
  };
}

async function runTestCommand(interaction: Interaction, env: Env): Promise<void> {
  await sleep(5000);
  await editOriginalInteractionResponse(
    env.DISCORD_APPLICATION_ID,
    interaction.token,
    env.DISCORD_TOKEN,
    'Hello World',
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    if (!signature || !timestamp) {
      return new Response('Bad request signature.', { status: 401 });
    }

    const rawBody = await request.text();
    const isValid = await verifyDiscordRequest(signature, timestamp, rawBody, env.SIGNATURE_PUBLIC_KEY);
    if (!isValid) {
      return new Response('Bad request signature.', { status: 401 });
    }

    let interaction: Interaction;
    try {
      interaction = JSON.parse(rawBody) as Interaction;
    } catch {
      return new Response('Bad request.', { status: 400 });
    }

    if (interaction.type === 1) {
      return jsonResponse({ type: 1 });
    }

    if (interaction.type === 2) {
      const commandName = interaction.data?.name?.toLowerCase();
      if (commandName === 'test') {
        ctx.waitUntil(runTestCommand(interaction, env));
        return jsonResponse({ type: 5 });
      }
      return new Response('Unknown Command', { status: 400 });
    }

    return new Response('Unknown Interaction Type', { status: 400 });
  },
};
