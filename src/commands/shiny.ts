import type {
  CommandRequest,
  CommandResult,
} from '@/core';

export const SHINY_COMMAND_NAME = 'shiny';

const SHINY_ROLL_MIN = 1;
const SHINY_ROLL_MAX = 8192;

function rollUniformInteger(minInclusive: number, maxInclusive: number): number {
  if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
    throw new Error('Uniform roll bounds must be integers');
  }

  const span = maxInclusive - minInclusive + 1;
  if (!Number.isInteger(span) || span <= 0) {
    throw new Error('Invalid integer span for uniform roll');
  }

  const maxUint16 = 0xffff;
  if (span > maxUint16 + 1) {
    throw new Error('Uniform roll span exceeds Uint16 sampling domain');
  }

  const maxAcceptable = Math.floor((maxUint16 + 1) / span) * span - 1;
  const sample = new Uint16Array(1);

  while (true) {
    crypto.getRandomValues(sample);
    const value = sample[0];
    if (value <= maxAcceptable) {
      return minInclusive + (value % span);
    }
  }
}

export function handleShinyCommand(request: CommandRequest): CommandResult {
  switch (request.kind) {
    case 'command': {
      const roll = rollUniformInteger(SHINY_ROLL_MIN, SHINY_ROLL_MAX);
      const content = roll === SHINY_ROLL_MAX
        ? `You rolled ${SHINY_ROLL_MAX}/${SHINY_ROLL_MAX}. ✨ SHINY ENCOUNTER! ✨`
        : `You rolled ${roll}/${SHINY_ROLL_MAX}.`;

      return {
        kind: 'channel-message',
        content,
        ephemeral: false,
      };
    }

    case 'modal-submit':
    case 'component':
      throw new Error('Unhandled command request');

    default:
      throw new Error('Unhandled command request');
  }
}
