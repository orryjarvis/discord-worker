import type { AiRuntimeEnv, FollowUpExecutionContext, FollowUpTask } from './core.js';
import { describeError, extractAiText, summarizeAiResultShape } from './ai.js';

export const EIGHT_BALL_COMMAND_NAME = '8ball';

const EIGHT_BALL_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const EIGHT_BALL_MISSING_PAYLOAD_MESSAGE = 'The magic 8-ball needs a message with text to read. Try again on a text message.';
const EIGHT_BALL_FAILURE_MESSAGE = 'The magic 8-ball is cloudy right now. Ask again in a moment.';

type EightBallTargetContext = {
  targetMessageId: string | null;
  targetMessageContent: string | null;
  targetMessageAuthorId: string | null;
};

function parseEightBallTargetContext(task: FollowUpTask): EightBallTargetContext {
  const targetMessageId = typeof task.payload.targetMessageId === 'string'
    ? task.payload.targetMessageId.trim() || null
    : null;
  const targetMessageContent = typeof task.payload.targetMessageContent === 'string'
    ? task.payload.targetMessageContent.trim() || null
    : null;
  const targetMessageAuthorId = typeof task.payload.targetMessageAuthorId === 'string'
    ? task.payload.targetMessageAuthorId.trim() || null
    : null;

  return {
    targetMessageId,
    targetMessageContent,
    targetMessageAuthorId,
  };
}

async function generateEightBallText(context: EightBallTargetContext, env: AiRuntimeEnv): Promise<string> {
  const authorReference = context.targetMessageAuthorId
    ? `<@${context.targetMessageAuthorId}>`
    : 'unknown user';

  const promptMessages = [
    {
      role: 'system',
      content:
        'You are a snarky Discord magic 8-ball. Reply with exactly one short, witty prediction sentence. Keep it playful and non-hateful. Avoid slurs, threats, or sexual content. Output only the final answer text.',
    },
    {
      role: 'user',
      content: [
        `Message author: ${authorReference}`,
        `Message id: ${context.targetMessageId ?? 'unknown'}`,
        `Message content: ${context.targetMessageContent}`,
        'Give a snarky magic 8-ball answer to that message.',
      ].join('\n'),
    },
  ];

  const rawResult = await env.AI.run(EIGHT_BALL_MODEL, {
    messages: promptMessages,
    temperature: 0.9,
  });

  console.log('8ball model output received', {
    model: EIGHT_BALL_MODEL,
    shape: summarizeAiResultShape(rawResult),
  });

  const output = extractAiText(rawResult);
  if (!output) {
    console.error('8ball model output had no extractable text', {
      model: EIGHT_BALL_MODEL,
      shape: summarizeAiResultShape(rawResult),
    });
    throw new Error('Workers AI returned no text output');
  }

  return output;
}

export async function executeEightBallFollowUp(
  task: FollowUpTask,
  env: AiRuntimeEnv,
  context: FollowUpExecutionContext,
): Promise<string> {
  const targetContext = parseEightBallTargetContext(task);
  if (!targetContext.targetMessageContent) {
    console.warn('8ball follow-up payload missing target message content', {
      messageId: context.messageId,
      targetMessageId: targetContext.targetMessageId,
    });
    return EIGHT_BALL_MISSING_PAYLOAD_MESSAGE;
  }

  try {
    return await generateEightBallText(targetContext, env);
  } catch (error) {
    console.error('8ball generation failed', {
      messageId: context.messageId,
      model: EIGHT_BALL_MODEL,
      targetMessageId: targetContext.targetMessageId,
      error: describeError(error),
    });
    return EIGHT_BALL_FAILURE_MESSAGE;
  }
}