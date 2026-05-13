# Design: Error Handling

This document defines how errors are caught, logged, and handled in discord-worker.

---

## Principles

1. **All errors must be caught** — Unhandled exceptions crash the worker
2. **Errors must be logged** — Enable debugging without exposing details to users
3. **User messages must be friendly** — Never expose stack traces or internal details
4. **Errors must be descriptive for agents** — Include context so agents can self-diagnose
5. **Errors must be traceable** — Include operation name, parameters (sanitized), and error details

---

## Error Categories

### 1. Request Validation Errors

**When:** Discord request fails signature validation or is malformed.

**Handle:** Return 401/400 immediately; log for security review.

```typescript
// src/auth.ts
export function validateSignature(request: Request): boolean {
  try {
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    // ... validation logic
  } catch (error) {
    console.error('[auth] Signature validation failed', { error });
    return false; // Return 401 to Discord
  }
}
```

### 2. Command Dispatch Errors

**When:** Command name is unknown or interaction is malformed.

**Handle:** Log error; return user-friendly response.

```typescript
// src/commands.ts
export async function handleCommand(interaction: Interaction): Promise<InteractionResponse> {
  try {
    const commandName = interaction.data?.name;
    if (!commandName) {
      throw new Error('No command name in interaction');
    }

    switch (commandName) {
      case 'reddit':
        return handleReddit(interaction);
      default:
        throw new Error(`Unknown command: ${commandName}`);
    }
  } catch (error) {
    console.error('[commands] Dispatch error', {
      commandName: interaction.data?.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Unknown command');
  }
}
```

### 3. Service Integration Errors

**When:** External API call fails.

**Handle:** Catch in service; throw with descriptive message; catch in command; return to user.

```typescript
// src/services/redditService.ts
export const redditService = {
  async fetchPost(subreddit: string) {
    try {
      const response = await fetch(`https://reddit.com/r/${subreddit}/random.json`);
      if (!response.ok) {
        throw new Error(`Reddit API returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(
        `RedditService: Failed to fetch ${subreddit}; ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  },
};

// src/commands/reddit.ts
export async function handleReddit(interaction: Interaction): Promise<InteractionResponse> {
  try {
    const subreddit = interaction.data?.options?.[0]?.value ?? 'typescript';
    const post = await redditService.fetchPost(subreddit);
    return successResponse(`📖 ${post.title}`);
  } catch (error) {
    console.error('[reddit] Command error', {
      subreddit: interaction.data?.options?.[0]?.value,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Failed to fetch Reddit post. Please try again.');
  }
}
```

### 4. Parameter Validation Errors

**When:** User provides invalid parameters.

**Handle:** Catch; return error message with hint.

```typescript
// src/commands/search.ts
export async function handleSearch(interaction: Interaction): Promise<InteractionResponse> {
  try {
    const query = interaction.data?.options?.[0]?.value;
    if (!query || typeof query !== 'string' || query.length === 0) {
      throw new Error('Search query is required and must be a non-empty string');
    }
    if (query.length > 100) {
      throw new Error('Search query must be 100 characters or less');
    }

    const results = await searchService.search(query);
    return successResponse(`Found ${results.length} results`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[search] Validation error', { message });
    return errorResponse(`Invalid search: ${message}`);
  }
}
```

---

## Error Response Structure

### Success Response

```typescript
function successResponse(content: string): InteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: { content },
  };
}
```

### Error Response

```typescript
function errorResponse(message: string): InteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: `❌ ${message}`,
      flags: MessageFlags.Ephemeral, // Only visible to user
    },
  };
}
```

---

## Logging Standards

### Good Logs

```typescript
// ✅ Contextual, sanitized, actionable
console.error('[reddit] Failed to fetch post', {
  subreddit: 'typescript',
  error: 'API returned 403',
  timestamp: new Date().toISOString(),
});

// ✅ Include operation and context
console.warn('[oauth] Token refresh failed', {
  userId: user.id,
  provider: 'reddit',
  reason: 'Invalid refresh token',
});
```

### Bad Logs

```typescript
// ❌ Raw error dump, no context
console.error(error);

// ❌ Exposes sensitive data
console.error('Failed to auth', { apiKey, password });

// ❌ No operation context
console.error('Error occurred');
```

### Log Levels

| Level | Use Case |
|-------|----------|
| `error` | Unexpected failures; external API errors; request validation failures |
| `warn` | Deprecated features; degraded functionality; recoverable errors |
| `info` | Important events; command execution (optional) |
| `debug` | Detailed flow info; only in development |

---

## Error Messages for Agents

When an error occurs that an agent should diagnose, structure the message to be actionable:

**Format:**

```
{ServiceName}: Failed to {operation}; {reason}. {hint}
```

**Examples:**

```
// ✅ Good: contextual, actionable
RedditService: Failed to fetch /r/typescript; API returned 403. Check subreddit name and permissions.

// ✅ Good: includes remediation
DiscordService: Failed to send message; rate limited. Retry after 60 seconds.

// ❌ Bad: cryptic
Failed to call API

// ❌ Bad: unclear root cause
Error: undefined is not a function

// ❌ Bad: exposes internals
RedditService: Failed due to JSON.parse() error in response handler
```

---

## Testing Error Cases

Every command and service must have error tests:

```typescript
describe('handleReddit', () => {
  it('should handle API error gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network timeout'));

    const interaction = createMockInteraction('reddit');
    const response = await handleReddit(interaction);

    // Should return error response, not throw
    expect(response.type).toBe(4);
    expect(response.data?.content).toContain('❌');
  });

  it('should log error with context', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('500'));

    await handleReddit(createMockInteraction('reddit'));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[reddit]'),
      expect.objectContaining({
        error: expect.any(String),
      })
    );
  });
});
```

---

## Common Error Patterns

### Pattern 1: Retry on Transient Error

```typescript
async function fetchWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 429 || response.status >= 500) {
        // Transient error; retry
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        continue;
      }
      // Non-transient error; throw immediately
      throw new Error(`API returned ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error; // Last retry failed
    }
  }
}
```

### Pattern 2: Validate Before Calling Service

```typescript
async function handleSearch(interaction: Interaction) {
  try {
    // Validate first
    const query = interaction.data?.options?.[0]?.value;
    if (typeof query !== 'string' || !query.trim()) {
      throw new Error('Search query is required');
    }

    // Then call service
    const results = await searchService.search(query);
    return successResponse(`Found ${results.length} results`);
  } catch (error) {
    // ...
  }
}
```

### Pattern 3: Partial Success (Don't Fail on One Failure)

```typescript
async function handleBulkFetch(ids: string[]) {
  const results = [];
  const errors = [];

  for (const id of ids) {
    try {
      const result = await fetchItem(id);
      results.push(result);
    } catch (error) {
      errors.push({ id, error });
    }
  }

  if (results.length === 0) {
    throw new Error('All fetches failed');
  }

  if (errors.length > 0) {
    console.warn('Some fetches failed', { errors });
  }

  return results;
}
```

---

## References

- [docs/design-docs/testing.md](./testing.md) — Error test patterns
- [docs/references/error-messages.md](../references/error-messages.md) — Catalog of common errors
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — System overview
