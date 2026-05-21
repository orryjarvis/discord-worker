import type { AiRuntimeEnv, FollowUpExecutionContext, FollowUpTask } from './core.js';
import { describeError, extractAiText, summarizeAiResultShape } from './ai.js';

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

export { extractAiText } from './ai.js';

async function generatePastifiedText(idea: string, env: AiRuntimeEnv): Promise<string> {
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

  console.log('Pastify model output received', {
    model: PASTIFY_MODEL,
    shape: summarizeAiResultShape(rawResult),
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
  env: AiRuntimeEnv,
  context: FollowUpExecutionContext,
): Promise<string> {
  const rawIdea = parsePastifyIdea(task);
  const idea = rawIdea?.trim() ?? '';
  if (!idea) {
    console.warn('Pastify follow-up payload missing idea', {
      messageId: context.messageId,
    });
    return PASTIFY_MISSING_PAYLOAD_MESSAGE;
  }

  try {
    return await generatePastifiedText(idea, env);
  } catch (error) {
    console.error('Pastify generation failed', {
      messageId: context.messageId,
      model: PASTIFY_MODEL,
      ideaLength: idea.length,
      error: describeError(error),
    });
    return PASTIFY_FAILURE_MESSAGE;
  }
}
