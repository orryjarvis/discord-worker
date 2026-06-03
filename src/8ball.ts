import type {
  FollowUpExecutionContext,
  FollowUpExecutionResult,
  FollowUpTask,
} from './core/index.js';
import type { AiRuntimeEnv } from './runtime.js';
import {
  type AiPromptMessage,
  describeError,
  runAiTextGeneration,
  summarizeAiResultShape,
} from './skills/ai.js';

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

  const promptMessages: AiPromptMessage[] = [
    {
      role: 'system',
      content:
        [
          'You are an unhinged-but-safe Discord Magic 8-Ball.',
          'Write exactly one short prediction line, inspired by classic Magic 8-Ball language.',
          'Your line should clearly feel like one of these categories: affirmative, doubtful, or negative.',
          'Use high-energy phrasing and chaotic flair, but keep it concise and readable.',
          'Keep the output to one sentence only.',
          'Do not include prefaces, explanations, roleplay markers, or quotation marks around the final line.',
          'Never include slurs, hateful content, threats, sexual content, or encouragement of self-harm.',
          'Output only the final answer sentence.',
        ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Message author: ${authorReference}`,
        `Message id: ${context.targetMessageId ?? 'unknown'}`,
        `Message content: ${context.targetMessageContent}`,
        'Give a chaotic Magic 8-Ball verdict that still sounds like a classic 8-ball phrase.',
      ].join('\n'),
    },
  ];

  const aiResult = await runAiTextGeneration(
    {
      model: EIGHT_BALL_MODEL,
      messages: promptMessages,
      temperature: 0.9,
    },
    env,
  );

  const output = aiResult.text;
  if (!output) {
    console.error('8ball model output had no extractable text', {
      model: EIGHT_BALL_MODEL,
      shape: summarizeAiResultShape(aiResult.rawResult),
    });
    throw new Error('Workers AI returned no text output');
  }

  return output;
}

export async function executeEightBallFollowUp(
  task: FollowUpTask,
  env: AiRuntimeEnv,
  context: FollowUpExecutionContext,
): Promise<FollowUpExecutionResult> {
  const targetContext = parseEightBallTargetContext(task);
  if (!targetContext.targetMessageContent) {
    console.warn('8ball follow-up payload missing target message content', {
      messageId: context.messageId,
      targetMessageId: targetContext.targetMessageId,
    });
    return {
      content: EIGHT_BALL_MISSING_PAYLOAD_MESSAGE,
    };
  }

  try {
    const content = await generateEightBallText(targetContext, env);
    return {
      content,
      renderHints: {
        ...(targetContext.targetMessageId ? { replyToMessageId: targetContext.targetMessageId } : {}),
        quotedSourceText: targetContext.targetMessageContent,
        quotedFallbackPrefix: '🎱',
        ...(targetContext.targetMessageAuthorId
          ? { quotedSourceAuthorId: targetContext.targetMessageAuthorId }
          : {}),
      },
    };
  } catch (error) {
    console.error('8ball generation failed', {
      messageId: context.messageId,
      model: EIGHT_BALL_MODEL,
      targetMessageId: targetContext.targetMessageId,
      error: describeError(error),
    });
    return {
      content: EIGHT_BALL_FAILURE_MESSAGE,
      renderHints: {
        ...(targetContext.targetMessageId ? { replyToMessageId: targetContext.targetMessageId } : {}),
        quotedSourceText: targetContext.targetMessageContent,
        quotedFallbackPrefix: '🎱',
        ...(targetContext.targetMessageAuthorId
          ? { quotedSourceAuthorId: targetContext.targetMessageAuthorId }
          : {}),
      },
    };
  }
}
