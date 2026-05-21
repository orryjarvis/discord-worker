import type { FollowUpTask } from './core.js';

export const PASTIFY_COMMAND_NAME = 'pastify';
export const PASTIFY_MODAL_ID = 'pastify_modal';
export const PASTIFY_MODAL_TEXT_INPUT_ID = 'pastify_modal_text';

const PASTIFY_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const PASTIFY_MISSING_PAYLOAD_MESSAGE = 'Could not process follow-up payload. Please try again.';
const PASTIFY_FAILURE_MESSAGE = 'Could not pastify that idea right now. Try again in a moment.';

type ModalComponentRows = Array<{
  components?: Array<{
    custom_id?: string;
    value?: string;
  }>;
}>;

export type PastifyModalParseResult =
  | { kind: 'unknown-modal' }
  | { kind: 'missing-text' }
  | {
    kind: 'parsed';
    commandName: typeof PASTIFY_COMMAND_NAME;
    text: string;
  };

export interface PastifyRuntimeEnv {
  AI: Ai;
}

export interface FollowUpExecutionContext {
  messageId: string;
  token: string;
}

function parsePastifyIdea(task: FollowUpTask): string | null {
  const idea = task.payload.idea;
  if (typeof idea !== 'string') {
    return null;
  }
  return idea;
}

function flattenModalText(components: ModalComponentRows | undefined): string | null {
  if (!components) {
    return null;
  }

  for (const row of components) {
    const inputs = row.components;
    if (!inputs) {
      continue;
    }

    for (const input of inputs) {
      if (input.custom_id === PASTIFY_MODAL_TEXT_INPUT_ID && typeof input.value === 'string') {
        return input.value;
      }
    }
  }

  return null;
}

export function parsePastifyModalSubmit(data: {
  customId: string;
  components?: ModalComponentRows;
}): PastifyModalParseResult {
  if (data.customId !== PASTIFY_MODAL_ID) {
    return { kind: 'unknown-modal' };
  }

  const text = flattenModalText(data.components);
  if (!text) {
    return { kind: 'missing-text' };
  }

  return {
    kind: 'parsed',
    commandName: PASTIFY_COMMAND_NAME,
    text,
  };
}

function extractAiText(result: unknown): string | null {
  const fromString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const fromContentArray = (value: unknown): string | null => {
    if (!Array.isArray(value)) {
      return null;
    }

    const chunks: string[] = [];
    for (const part of value) {
      if (!part || typeof part !== 'object') {
        continue;
      }
      const partObj = part as Record<string, unknown>;
      const text = fromString(partObj.text);
      if (text) {
        chunks.push(text);
      }
    }

    if (chunks.length === 0) {
      return null;
    }
    return chunks.join('\n').trim();
  };

  const fromMessage = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const msg = value as Record<string, unknown>;
    return fromString(msg.content) ?? fromContentArray(msg.content);
  };

  const fromChoices = (value: unknown): string | null => {
    if (!Array.isArray(value)) {
      return null;
    }

    for (const choice of value) {
      if (!choice || typeof choice !== 'object') {
        continue;
      }

      const choiceObj = choice as Record<string, unknown>;
      const messageText = fromMessage(choiceObj.message);
      if (messageText) {
        return messageText;
      }

      const directText = fromString(choiceObj.text);
      if (directText) {
        return directText;
      }
    }

    return null;
  };

  const fromOutput = (value: unknown): string | null => {
    if (!Array.isArray(value)) {
      return null;
    }

    const chunks: string[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const itemObj = item as Record<string, unknown>;
      const text = fromString(itemObj.text) ?? fromContentArray(itemObj.content);
      if (text) {
        chunks.push(text);
      }
    }

    if (chunks.length === 0) {
      return null;
    }
    return chunks.join('\n').trim();
  };

  if (typeof result === 'string') {
    return fromString(result);
  }

  if (!result || typeof result !== 'object') {
    return null;
  }

  const obj = result as Record<string, unknown>;
  const direct = fromString(obj.response) ?? fromString(obj.text) ?? fromString(obj.output_text);
  if (direct) {
    return direct;
  }

  const topLevelChoices = fromChoices(obj.choices);
  if (topLevelChoices) {
    return topLevelChoices;
  }

  const topLevelOutput = fromOutput(obj.output);
  if (topLevelOutput) {
    return topLevelOutput;
  }

  const nested = obj.result;
  if (nested && typeof nested === 'object') {
    const nestedObj = nested as Record<string, unknown>;
    const nestedDirect = fromString(nestedObj.response) ?? fromString(nestedObj.text) ?? fromString(nestedObj.output_text);
    if (nestedDirect) {
      return nestedDirect;
    }

    const nestedChoices = fromChoices(nestedObj.choices);
    if (nestedChoices) {
      return nestedChoices;
    }

    const nestedOutput = fromOutput(nestedObj.output);
    if (nestedOutput) {
      return nestedOutput;
    }
  }

  return null;
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

async function generatePastifiedText(idea: string, env: PastifyRuntimeEnv): Promise<string> {
  const promptMessages = [
    {
      role: 'system',
      content:
        'You are a Twitch chat copypasta writer. Turn the idea into one energetic, funny, copy/paste-ready message. Keep it to 2-5 lines, avoid slurs/harassment, and output only the final copypasta text.',
    },
    {
      role: 'user',
      content: `Idea: ${idea}`,
    },
  ];

  const rawResult = await env.AI.run(PASTIFY_MODEL, {
    messages: promptMessages,
    temperature: 0.9,
  });

  console.log('Pastify raw model output', {
    model: PASTIFY_MODEL,
    rawResult,
  });

  const output = extractAiText(rawResult);
  if (!output) {
    console.error('Pastify model output had no extractable text', {
      model: PASTIFY_MODEL,
      shape: summarizeAiResultShape(rawResult),
    });
    throw new Error('Workers AI returned no text output');
  }

  return output;
}

export async function executePastifyFollowUp(
  task: FollowUpTask,
  env: PastifyRuntimeEnv,
  context: FollowUpExecutionContext,
): Promise<string> {
  const rawIdea = parsePastifyIdea(task);
  const idea = rawIdea?.trim() ?? '';
  if (!idea) {
    console.warn('Pastify follow-up payload missing idea', {
      messageId: context.messageId,
      token: context.token,
    });
    return PASTIFY_MISSING_PAYLOAD_MESSAGE;
  }

  try {
    return await generatePastifiedText(idea, env);
  } catch (error) {
    console.error('Pastify generation failed', {
      messageId: context.messageId,
      token: context.token,
      model: PASTIFY_MODEL,
      ideaLength: idea.length,
      error: describeError(error),
    });
    return PASTIFY_FAILURE_MESSAGE;
  }
}
