export function extractAiText(result: unknown): string | null {
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

export function summarizeAiResultShape(result: unknown): Record<string, unknown> {
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

export function describeError(error: unknown): Record<string, unknown> {
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