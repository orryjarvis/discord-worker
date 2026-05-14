import { verifyDiscordRequest, jsonResponse, editOriginalInteractionResponse } from './discord.js';

interface FollowUpMessage {
  token: string;
}

interface Env {
  DISCORD_APPLICATION_ID: string;
  SIGNATURE_PUBLIC_KEY: string;
  DISCORD_TOKEN: string;
  FOLLOW_UP_QUEUE: Queue<FollowUpMessage>;
  DISCORD_API_BASE?: string;
}

interface Interaction {
  type: number;
  token: string;
  data?: {
    name?: string;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
        await env.FOLLOW_UP_QUEUE.send({ token: interaction.token }, { delaySeconds: 5 });
        return jsonResponse({ type: 5 });
      }
      return new Response('Unknown Command', { status: 400 });
    }

    return new Response('Unknown Interaction Type', { status: 400 });
  },

  async queue(batch: MessageBatch<FollowUpMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const response = await editOriginalInteractionResponse(
        env.DISCORD_APPLICATION_ID,
        message.body.token,
        env.DISCORD_TOKEN,
        'Hello World',
        env.DISCORD_API_BASE,
      );

      if (!response.ok) {
        throw new Error(`Failed to edit original interaction response: ${response.status} ${response.statusText}`);
      }

      message.ack();
    }
  },
};
