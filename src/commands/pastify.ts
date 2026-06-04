import type {
  FollowUpExecutionContext,
  FollowUpExecutionResult,
  FollowUpTask,
} from '@/core';
import type { AiRuntimeEnv } from '@/skills/ai';
import {
  type AiPromptMessage,
  describeError,
  runAiTextGeneration,
  summarizeAiResultShape,
} from '@/skills/ai';
import { extractModalFields, type ModalComponentRows } from '@/skills/modalFields';

export const PASTIFY_COMMAND_NAME = 'pastify';
export const PASTIFY_MODAL_ID = 'pastify_modal';
export const PASTIFY_MODAL_TEXT_INPUT_ID = 'pastify_modal_text';

const PASTIFY_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const PASTIFY_MISSING_PAYLOAD_MESSAGE = 'Could not process follow-up payload. Please try again.';
const PASTIFY_FAILURE_MESSAGE = 'Could not pastify that idea right now. Try again in a moment.';

export type PastifyModalParseResult =
  | { kind: 'unknown-modal' }
  | { kind: 'missing-fields' }
  | {
    kind: 'parsed';
    commandName: typeof PASTIFY_COMMAND_NAME;
    fields: Record<string, string>;
  };

function parsePastifyIdea(task: FollowUpTask): string | null {
  const idea = task.payload.idea;
  if (typeof idea !== 'string') {
    return null;
  }

  return idea;
}

export function parsePastifyModalSubmit(data: {
  customId: string;
  components?: ModalComponentRows;
}): PastifyModalParseResult {
  if (data.customId !== PASTIFY_MODAL_ID) {
    return { kind: 'unknown-modal' };
  }

  const fields = extractModalFields(data.components);
  const text = fields[PASTIFY_MODAL_TEXT_INPUT_ID]?.trim();
  if (!text) {
    return { kind: 'missing-fields' };
  }

  return {
    kind: 'parsed',
    commandName: PASTIFY_COMMAND_NAME,
    fields: {
      [PASTIFY_MODAL_TEXT_INPUT_ID]: text,
    },
  };
}

export { extractAiText } from '@/skills/ai';

async function generatePastifiedText(idea: string, env: AiRuntimeEnv): Promise<string> {
  const promptMessages: AiPromptMessage[] = [
    {
      role: 'system',
      content:
        [
          'You are a deranged Twitch chat copypasta gremlin writing viral spam for Discord.',
          'Turn the user idea into one chaotic, hilarious copypasta block with escalating absurdity.',
          'Use 2-5 short lines and make it feel instantly copy/paste-ready.',
          'No intro text, no explanation, and no wrapping quotes around the final output.',
          'Do not include slurs, hate, sexual content, threats, or encouragement of self-harm.',
          'Output only the final copypasta block.',
        ].join(' '),
    },
    {
      role: 'user',
      content: `Idea to mutate into cursed copypasta: ${idea}`,
    },
  ];

  const aiResult = await runAiTextGeneration(
    {
      model: PASTIFY_MODEL,
      messages: promptMessages,
      temperature: 0.9,
    },
    env,
  );

  const output = aiResult.text;
  if (!output) {
    console.error('Pastify model output had no extractable text', {
      model: PASTIFY_MODEL,
      shape: summarizeAiResultShape(aiResult.rawResult),
    });
    throw new Error('Workers AI returned no text output');
  }

  return output;
}

export async function executePastifyFollowUp(
  task: FollowUpTask,
  env: AiRuntimeEnv,
  context: FollowUpExecutionContext,
): Promise<FollowUpExecutionResult> {
  const rawIdea = parsePastifyIdea(task);
  const idea = rawIdea?.trim() ?? '';
  if (!idea) {
    console.warn('Pastify follow-up payload missing idea', {
      messageId: context.messageId,
    });
    return {
      content: PASTIFY_MISSING_PAYLOAD_MESSAGE,
    };
  }

  try {
    return {
      content: await generatePastifiedText(idea, env),
    };
  } catch (error) {
    console.error('Pastify generation failed', {
      messageId: context.messageId,
      model: PASTIFY_MODEL,
      ideaLength: idea.length,
      error: describeError(error),
    });
    return {
      content: PASTIFY_FAILURE_MESSAGE,
    };
  }
}
