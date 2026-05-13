# References: Code Patterns

This document catalogs common code patterns used in discord-worker. Use these as templates when adding commands, services, or utilities.

---

## Command Pattern

**Template for adding a new command:**

```typescript
// src/commands/mycommand.ts

import { Interaction, InteractionResponse } from 'discord-api-types/v10';
import { myService } from '../services/myService';

/**
 * Handle /mycommand interaction.
 * @param interaction - Discord interaction
 * @returns Response to send back to Discord
 */
export async function handleMyCommand(
  interaction: Interaction
): Promise<InteractionResponse> {
  try {
    // 1. Extract and validate parameters
    const param = interaction.data?.options?.[0]?.value;
    if (typeof param !== 'string' || !param.trim()) {
      return errorResponse('Parameter is required');
    }

    // 2. Call services
    const result = await myService.doSomething(param);

    // 3. Compose response
    return successResponse(`Success: ${result}`);
  } catch (error) {
    // 4. Handle errors
    console.error('[mycommand] Error', {
      param: interaction.data?.options?.[0]?.value,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('An error occurred. Please try again.');
  }
}

function successResponse(content: string): InteractionResponse {
  return {
    type: 4, // ChannelMessageWithSource
    data: { content },
  };
}

function errorResponse(message: string): InteractionResponse {
  return {
    type: 4,
    data: { content: `❌ ${message}` },
  };
}
```

---

## Service Pattern

**Template for adding a new service:**

```typescript
// src/services/myService.ts

interface MyAPIResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Service for integrating with external system.
 */
export const myService = {
  /**
   * Do something with external API.
   * @param param - Input parameter
   * @returns Result from external API
   * @throws Error if API call fails
   */
  async doSomething(param: string): Promise<unknown> {
    try {
      // Build URL with parameters
      const url = new URL('https://api.example.com/endpoint');
      url.searchParams.append('q', param);

      // Call external API
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`,
          'User-Agent': 'discord-worker',
        },
      });

      // Check HTTP status
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      // Parse response
      const data = (await response.json()) as MyAPIResponse;

      if (!data.success) {
        throw new Error(data.error ?? 'Unknown error');
      }

      return data.data;
    } catch (error) {
      throw new Error(
        `MyService: Failed to do something; ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  },

  /**
   * Another operation.
   */
  async anotherOperation(input: string): Promise<void> {
    // ...
  },
};
```

---

## Error Handling Pattern

**Template for catching and handling errors:**

```typescript
// In commands
export async function handleCommand(interaction: Interaction) {
  try {
    // Validate input
    const value = interaction.data?.options?.[0]?.value;
    if (!value) {
      throw new Error('Required parameter missing');
    }

    // Call service
    const result = await myService.doSomething(value);

    // Return success
    return {
      type: 4,
      data: { content: `✅ ${result}` },
    };
  } catch (error) {
    // Log with context
    console.error('[commandName] Error', {
      param: interaction.data?.options?.[0]?.value,
      userId: interaction.member?.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    // Return user-friendly error
    const message = error instanceof Error
      ? error.message
      : 'An error occurred';

    return {
      type: 4,
      data: { content: `❌ ${message}` },
    };
  }
}

// In services
export const myService = {
  async doSomething(param: string): Promise<string> {
    try {
      const response = await fetch('https://api.example.com/...');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      // Throw with service context
      throw new Error(
        `MyService: Failed to do something; ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  },
};
```

---

## Async/Await Pattern

**Pattern for handling concurrent async calls:**

```typescript
// Serial (one after another)
async function doSerially() {
  const result1 = await api.call1();
  const result2 = await api.call2(result1); // Depends on result1
  return result2;
}

// Concurrent (at the same time)
async function doConcurrently() {
  const [result1, result2] = await Promise.all([
    api.call1(),
    api.call2(),
  ]);
  return [result1, result2];
}

// With error handling
async function doWithErrorHandling() {
  const results = [];
  const errors = [];

  for (const item of items) {
    try {
      const result = await api.call(item);
      results.push(result);
    } catch (error) {
      errors.push({ item, error });
    }
  }

  if (results.length === 0) {
    throw new Error('All calls failed');
  }

  if (errors.length > 0) {
    console.warn('Some calls failed', { errors });
  }

  return results;
}
```

---

## Type Guard Pattern

**Pattern for checking and narrowing types:**

```typescript
// Check value exists
function getValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected string');
  }
  return value;
}

// Check object shape
interface User {
  id: string;
  name: string;
}

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).name === 'string'
  );
}

// Usage
if (isUser(data)) {
  console.log(data.name); // Safe; TypeScript knows it's User
}

// Optional chaining with defaults
const name = data?.user?.name ?? 'Unknown';
const age = data?.age ?? 0;
```

---

## Retry Pattern

**Pattern for retrying on transient errors:**

```typescript
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  delayMs = 1000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

      // Success on 2xx
      if (response.ok) {
        return response;
      }

      // Transient errors: retry
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries - 1) {
          // Exponential backoff
          const backoff = delayMs * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
      }

      // Non-transient error: fail immediately
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error; // Last attempt; give up
      }

      // Check if error is transient (network timeout)
      if (error instanceof TypeError && error.message.includes('timeout')) {
        const backoff = delayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }

      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}
```

---

## Testing Pattern

**Pattern for testing commands with mocks:**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleMyCommand } from '../../../src/commands/mycommand';
import { myService } from '../../../src/services/myService';

describe('handleMyCommand', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('should return success response', async () => {
    // Mock service
    vi.spyOn(myService, 'doSomething').mockResolvedValueOnce('result');

    // Create mock interaction
    const interaction = {
      data: {
        name: 'mycommand',
        options: [{ name: 'param', value: 'test' }],
      },
    };

    // Execute
    const response = await handleMyCommand(interaction as any);

    // Verify
    expect(response.type).toBe(4);
    expect(response.data?.content).toContain('result');
    expect(myService.doSomething).toHaveBeenCalledWith('test');
  });

  it('should handle missing parameter', async () => {
    const interaction = {
      data: { name: 'mycommand', options: [] },
    };

    const response = await handleMyCommand(interaction as any);

    expect(response.data?.content).toContain('❌');
  });

  it('should handle service error', async () => {
    vi.spyOn(myService, 'doSomething').mockRejectedValueOnce(
      new Error('API failed')
    );

    const interaction = {
      data: {
        name: 'mycommand',
        options: [{ name: 'param', value: 'test' }],
      },
    };

    const response = await handleMyCommand(interaction as any);

    expect(response.data?.content).toContain('❌');
    expect(response.data?.content).not.toThrow(); // Should not throw
  });
});
```

---

## Logging Pattern

**Pattern for structured logging:**

```typescript
// ✅ Good: contextual, structured
console.error('[mycommand] Failed to fetch post', {
  subreddit: 'typescript',
  error: 'API returned 403',
  userId: interaction.member?.user?.id,
  timestamp: new Date().toISOString(),
});

// ✅ Good: include operation name
console.warn('[redditService] Token refresh failed', {
  userId: userId,
  provider: 'reddit',
  reason: 'Invalid refresh token',
});

// ✅ Good: log at appropriate level
console.debug('[mycommand] Processing request'); // Debug: detailed flow
console.info('[mycommand] Successfully completed'); // Info: important events
console.warn('[mycommand] Retry attempt 2 of 3'); // Warn: degradation
console.error('[mycommand] Failed after 3 retries'); // Error: failure

// ❌ Bad: raw error dump
console.error(error);

// ❌ Bad: exposes sensitive data
console.error('Auth failed', { token, apiKey, password });

// ❌ Bad: no context
console.error('Error');
```

---

## Common Utilities

### Extract Parameter from Interaction

```typescript
function getParam(interaction: Interaction, index: number = 0): string | null {
  const value = interaction.data?.options?.[index]?.value;
  if (typeof value === 'string') {
    return value;
  }
  return null;
}

// Usage
const subreddit = getParam(interaction, 0) ?? 'typescript';
```

### Create Response Helper

```typescript
function createResponse(
  content: string,
  options?: { error?: boolean; ephemeral?: boolean }
): InteractionResponse {
  const prefix = options?.error ? '❌ ' : '';
  return {
    type: 4,
    data: {
      content: prefix + content,
      flags: options?.ephemeral ? 64 : undefined, // 64 = Ephemeral
    },
  };
}

// Usage
createResponse('Success!');
createResponse('Error occurred', { error: true, ephemeral: true });
```

---

## References

- [docs/design-docs/commands.md](../design-docs/commands.md) — Adding commands
- [docs/design-docs/services.md](../design-docs/services.md) — Adding services
- [docs/design-docs/testing.md](../design-docs/testing.md) — Testing patterns
- [docs/design-docs/error-handling.md](../design-docs/error-handling.md) — Error handling
