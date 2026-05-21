import type { AiRuntimeEnv, FollowUpExecutionContext, FollowUpTask } from './core.js';
import { extractAiText } from './pastify.js';

export const INSULT_COMMAND_NAME = 'insult';

const INSULT_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const INSULT_MISSING_PAYLOAD_MESSAGE = 'Could not figure out who to roast. Try the command again and pick someone to insult.';
const INSULT_FAILURE_MESSAGE = 'I had a light-hearted roast ready, but the punchline got lost. Try again in a moment.';

function parseInsultTarget(task: FollowUpTask): string | null {
  const targetUserId = task.payload.targetUserId;
  if (typeof targetUserId !== 'string') {
    return null;
  }

  const trimmed = targetUserId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function summarizeAiResultShape(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== 'object') {
    return { type: typeof result };
  }

  const obj = result as Record<string, unknown>;
  const nested = obj.result;
  const nestedObj = nested && typeof nested === 'object'
    ? nested as Record<string, unknown>
    : null;

  return {
    topLevelKeys: Object.keys(obj).slice(0, 20),
    resultKeys: nestedObj ? Object.keys(nestedObj).slice(0, 20) : null,
    hasChoices: Array.isArray(obj.choices),
    hasResultChoices: nestedObj ? Array.isArray(nestedObj.choices) : false,
    hasOutput: Array.isArray(obj.output),
    hasResultOutput: nestedObj ? Array.isArray(nestedObj.output) : false,
  };
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const typedError = error as Error & { cause?: unknown; code?: string };
    return {
      name: typedError.name,
      message: typedError.message,
      code: typedError.code,
      stack: typedError.stack,
      cause: typedError.cause,
    };
  }

  return {
    message: String(error),
  };
}

async function generateInsultText(targetMention: string, env: AiRuntimeEnv): Promise<string> {
  const promptMessages = [
    {
      role: 'system',
      content:
        'You write playful, light-hearted gaming roasts for Discord. Keep it affectionate and silly, avoid slurs, hate, threats, sexual content, or cruelty, and output only the roast text without extra explanation.',
    },
    {
      role: 'user',
      content: `Write one short, funny roast for ${targetMention}. Make it feel like friendly banter in a game lobby.`,
    },
  ];

  const rawResult = await env.AI.run(INSULT_MODEL, {
    messages: promptMessages,
    temperature: 0.9,
  });

  console.log('Insult model output received', {
    model: INSULT_MODEL,
    shape: summarizeAiResultShape(rawResult),
  });

  const output = extractAiText(rawResult);
  if (!output) {
    console.error('Insult model output had no extractable text', {
      model: INSULT_MODEL,
      shape: summarizeAiResultShape(rawResult),
    });
    throw new Error('Workers AI returned no text output');
  }

  return `${targetMention} ${output}`;
}

export async function executeInsultFollowUp(
  task: FollowUpTask,
  env: AiRuntimeEnv,
  context: FollowUpExecutionContext,
): Promise<string> {
  const targetUserId = parseInsultTarget(task);
  if (!targetUserId) {
    console.warn('Insult follow-up payload missing target user id', {
      messageId: context.messageId,
    });
    return INSULT_MISSING_PAYLOAD_MESSAGE;
  }

  const targetMention = `<@${targetUserId}>`;

  try {
    return await generateInsultText(targetMention, env);
  } catch (error) {
    console.error('Insult generation failed', {
      messageId: context.messageId,
      model: INSULT_MODEL,
      targetUserId,
      error: describeError(error),
    });
    return `${targetMention} ${INSULT_FAILURE_MESSAGE}`;
  }
}