import { verifyDiscordRequest, jsonResponse, editOriginalInteractionResponse } from './discord.js';

interface FollowUpMessage {
  token: string;
}

interface SubmissionRecord {
  interactionId: string;
  userId: string | null;
  guildId: string | null;
  channelId: string | null;
  customId: string;
  text: string;
  submittedAt: string;
}

interface Env {
  DISCORD_APPLICATION_ID: string;
  SIGNATURE_PUBLIC_KEY: string;
  DISCORD_TOKEN: string;
  FOLLOW_UP_QUEUE: Queue<FollowUpMessage>;
  KV: KVNamespace;
  DISCORD_API_BASE_URL?: string;
  TEST_FOLLOWUPS?: KVNamespace;
}

interface Interaction {
  id: string;
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  member?: {
    user?: {
      id?: string;
    };
  };
  user?: {
    id?: string;
  };
  data?: {
    name?: string;
    custom_id?: string;
    components?: Array<{
      components?: Array<{
        custom_id?: string;
        value?: string;
      }>;
    }>;
  };
}

const PATCH_SINK_RE = /^\/__test\/discord\/api\/v10\/webhooks\/([^/]+)\/([^/]+)\/messages\/@original$/;
const GET_FOLLOWUP_RE = /^\/__test\/followups\/([^/]+)$/;
const GET_SUBMISSION_RE = /^\/__test\/submissions\/([^/]+)$/;

const OPEN_MODAL_BUTTON_ID = 'test_open_modal';
const MODAL_ID = 'test_modal';
const MODAL_TEXT_INPUT_ID = 'test_modal_text';

function extractModalTextValue(interaction: Interaction): string | null {
  const rows = interaction.data?.components;
  if (!rows) {
    return null;
  }

  for (const row of rows) {
    const inputs = row.components;
    if (!inputs) {
      continue;
    }
    for (const input of inputs) {
      if (input.custom_id === MODAL_TEXT_INPUT_ID && typeof input.value === 'string') {
        return input.value;
      }
    }
  }

  return null;
}

async function handleTestSink(request: Request, env: Env, pathname: string): Promise<Response> {
  const patchMatch = PATCH_SINK_RE.exec(pathname);
  if (request.method === 'PATCH' && patchMatch && env.TEST_FOLLOWUPS) {
    const applicationId = patchMatch[1];
    const interactionToken = patchMatch[2];
    const correlationMatch = /^test-token-(.+)$/.exec(interactionToken);
    if (!correlationMatch) {
      return new Response('Bad Request', { status: 400 });
    }
    const correlationId = correlationMatch[1];
    const body = await request.text();
    const entry = JSON.stringify({
      method: request.method,
      path: pathname,
      body,
      receivedAt: new Date().toISOString(),
      applicationId,
      interactionToken,
    });
    await env.TEST_FOLLOWUPS.put(`followup:${correlationId}`, entry, { expirationTtl: 300 });
    return jsonResponse({});
  }

  const getMatch = GET_FOLLOWUP_RE.exec(pathname);
  if (request.method === 'GET' && getMatch && env.TEST_FOLLOWUPS) {
    const correlationId = getMatch[1];
    const entry = await env.TEST_FOLLOWUPS.get(`followup:${correlationId}`);
    if (!entry) {
      return new Response('Not Found', { status: 404 });
    }
    await env.TEST_FOLLOWUPS.delete(`followup:${correlationId}`);
    return jsonResponse(JSON.parse(entry) as unknown);
  }

  if (request.method === 'DELETE' && getMatch && env.TEST_FOLLOWUPS) {
    const correlationId = getMatch[1];
    await env.TEST_FOLLOWUPS.delete(`followup:${correlationId}`);
    return new Response(null, { status: 204 });
  }

  const submissionMatch = GET_SUBMISSION_RE.exec(pathname);
  if (request.method === 'GET' && submissionMatch) {
    const interactionId = submissionMatch[1];
    const entry = await env.KV.get(interactionId);
    if (!entry) {
      return new Response('Not Found', { status: 404 });
    }
    return jsonResponse(JSON.parse(entry) as unknown);
  }

  if (request.method === 'DELETE' && submissionMatch) {
    const interactionId = submissionMatch[1];
    await env.KV.delete(interactionId);
    return new Response(null, { status: 204 });
  }

  return new Response('Not Found', { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/__test/')) {
      return handleTestSink(request, env, url.pathname);
    }

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
        await env.FOLLOW_UP_QUEUE.send({ token: interaction.token });
        return jsonResponse({ type: 5 });
      }
      return new Response('Unknown Command', { status: 400 });
    }

    if (interaction.type === 3) {
      if (interaction.data?.custom_id !== OPEN_MODAL_BUTTON_ID) {
        return new Response('Unknown Component', { status: 400 });
      }

      return jsonResponse({
        type: 9,
        data: {
          custom_id: MODAL_ID,
          title: 'Submit Text',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: MODAL_TEXT_INPUT_ID,
                  label: 'Text',
                  style: 2,
                  min_length: 1,
                  max_length: 1000,
                  required: true,
                  placeholder: 'Enter free-form text',
                },
              ],
            },
          ],
        },
      });
    }

    if (interaction.type === 5) {
      if (interaction.data?.custom_id !== MODAL_ID) {
        return new Response('Unknown Modal', { status: 400 });
      }

      const text = extractModalTextValue(interaction);
      if (!text) {
        return new Response('Missing Modal Text', { status: 400 });
      }

      const submission: SubmissionRecord = {
        interactionId: interaction.id,
        userId: interaction.member?.user?.id ?? interaction.user?.id ?? null,
        guildId: interaction.guild_id ?? null,
        channelId: interaction.channel_id ?? null,
        customId: interaction.data.custom_id,
        text,
        submittedAt: new Date().toISOString(),
      };

      await env.KV.put(interaction.id, JSON.stringify(submission));

      return jsonResponse({
        type: 4,
        data: {
          content: 'Submission saved.',
          flags: 64,
        },
      });
    }

    return new Response('Unknown Interaction Type', { status: 400 });
  },

  async queue(batch: MessageBatch<FollowUpMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const response = await editOriginalInteractionResponse(
        env.DISCORD_APPLICATION_ID,
        message.body.token,
        env.DISCORD_TOKEN,
        {
          content: 'Click to open the form.',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  custom_id: OPEN_MODAL_BUTTON_ID,
                  label: 'Open form',
                  style: 1,
                },
              ],
            },
          ],
        },
        env.DISCORD_API_BASE_URL,
      );

      if (!response.ok) {
        throw new Error(`Failed to edit original interaction response: ${response.status} ${response.statusText}`);
      }

      message.ack();
    }
  },
};
