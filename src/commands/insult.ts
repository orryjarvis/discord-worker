import type {
  FollowUpExecutionContext,
  FollowUpExecutionResult,
  FollowUpTask,
} from '../core/index.js';
import type { AiRuntimeEnv } from '../skills/ai.js';
import {
  type AiPromptMessage,
  describeError,
  runAiTextGeneration,
  summarizeAiResultShape,
} from '../skills/ai.js';

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

async function generateInsultText(targetMention: string, env: AiRuntimeEnv): Promise<string> {
  const promptMessages: AiPromptMessage[] = [
    {
      role: 'system',
      content:
        [
          'You write absurd, over-the-top Discord lobby roasts that are clearly jokes between friends.',
          'Style should be sharp, outrageous, and chaotic, but never hateful or cruel.',
          'Write one compact roast line that sounds punchy and memorable.',
          'No slurs, no hate, no threats, no sexual content, no encouragement of self-harm, and no real-world protected-class attacks.',
          'No disclaimers, no setup text, and no extra explanation.',
          'Output only the roast line.',
        ].join(' '),
    },
    {
      role: 'user',
      content: `Write one outrageous but safe roast for ${targetMention}. Make it sound like chaotic game-lobby banter.`,
    },
  ];

  const aiResult = await runAiTextGeneration(
    {
      model: INSULT_MODEL,
      messages: promptMessages,
      temperature: 0.9,
    },
    env,
  );

  const output = aiResult.text;
  if (!output) {
    console.error('Insult model output had no extractable text', {
      model: INSULT_MODEL,
      shape: summarizeAiResultShape(aiResult.rawResult),
    });
    throw new Error('Workers AI returned no text output');
  }

  return `${targetMention} ${output}`;
}

export async function executeInsultFollowUp(
  task: FollowUpTask,
  env: AiRuntimeEnv,
  context: FollowUpExecutionContext,
): Promise<FollowUpExecutionResult> {
  const targetUserId = parseInsultTarget(task);
  if (!targetUserId) {
    console.warn('Insult follow-up payload missing target user id', {
      messageId: context.messageId,
    });
    return {
      content: INSULT_MISSING_PAYLOAD_MESSAGE,
    };
  }

  const targetMention = `<@${targetUserId}>`;

  try {
    return {
      content: await generateInsultText(targetMention, env),
    };
  } catch (error) {
    console.error('Insult generation failed', {
      messageId: context.messageId,
      model: INSULT_MODEL,
      targetUserId,
      error: describeError(error),
    });
    return {
      content: `${targetMention} ${INSULT_FAILURE_MESSAGE}`,
    };
  }
}
