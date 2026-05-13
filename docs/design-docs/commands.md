# Design: Adding a Command

This guide teaches you how to add a new command to discord-worker, from design through testing and documentation.

---

## Overview

A command is a Discord slash command handler. The flow is:

1. **User types** `/mycommand` in Discord
2. **Discord sends** an Interaction to the bot
3. **Bot routes** to the command handler
4. **Handler executes** logic (call services, compose response)
5. **Bot returns** InteractionResponse to Discord
6. **Discord displays** result to user

---

## Anatomy of a Command

```typescript
// src/commands/mycommand.ts

import { Interaction, InteractionResponse } from 'discord-api-types/v10';
import { myService } from '../services/myService';

export async function handleMyCommand(
  interaction: Interaction
): Promise<InteractionResponse> {
  try {
    // 1. Extract parameters from interaction
    const param = interaction.data?.options?.[0]?.value;

    // 2. Call services
    const result = await myService.doSomething(param);

    // 3. Compose response
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Result: ${result}`,
      },
    };
  } catch (error) {
    // 4. Handle errors gracefully
    console.error('[mycommand] Error:', error);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: 'An error occurred. Please try again.',
      },
    };
  }
}
```

---

## Step-by-Step: Add a Command

### 1. Create the Command File

**File:** `src/commands/{commandName}.ts`

```typescript
import { Interaction, InteractionResponse } from 'discord-api-types/v10';

export async function handle{CommandName}(
  interaction: Interaction
): Promise<InteractionResponse> {
  try {
    // TODO: Implement command logic
    return {
      type: 4, // InteractionResponseType.ChannelMessageWithSource
      data: { content: 'Hello!' },
    };
  } catch (error) {
    console.error('[{commandName}] Error:', error);
    return {
      type: 4,
      data: { content: 'An error occurred.' },
    };
  }
}
```

### 2. Register the Command

**File:** `src/commands.ts`

Add your handler to the routing logic:

```typescript
import { handle{CommandName} } from './commands/{commandName}';

export async function handleCommand(
  interaction: Interaction
): Promise<InteractionResponse> {
  const commandName = interaction.data?.name;

  switch (commandName) {
    case '{commandName}':
      return handle{CommandName}(interaction);
    // ... other commands
    default:
      return errorResponse('Unknown command');
  }
}
```

### 3. Write Tests

**Location:** `test/e2e/commands/{commandName}.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { handle{CommandName} } from '../../../src/commands/{commandName}';
import { createMockInteraction } from '../setup.shared';

describe('handle{CommandName}', () => {
  it('should return a success response', async () => {
    const interaction = createMockInteraction('{commandName}');
    const response = await handle{CommandName}(interaction);

    expect(response.type).toBe(4);
    expect(response.data?.content).toContain('expected text');
  });

  it('should handle errors gracefully', async () => {
    const interaction = createMockInteraction('{commandName}', { invalid: true });
    const response = await handle{CommandName}(interaction);

    expect(response.type).toBe(4);
    expect(response.data?.content).toContain('error');
  });
});
```

### 4. Validate Locally

```bash
npm run check    # Type check
npm run lint     # Lint
npm test         # Unit + integration tests
npm run e2e      # End-to-end tests
```

### 5. Update Documentation

If your command has public parameters or behavior, document it:

- **If a new service is required:** See [docs/design-docs/services.md](./services.md) and update [ARCHITECTURE.md](../../ARCHITECTURE.md)
- **If a new external API is called:** Update the services table in [ARCHITECTURE.md](../../ARCHITECTURE.md)
- **If the command is exported:** Add to [AGENTS.md](../../AGENTS.md) if agents need to know about it

---

## Command Best Practices

### ✅ Do

- **Keep logic in services** — Commands should be thin; call services for business logic
- **Validate parameters** — Check interaction.data exists and has expected shape
- **Handle errors explicitly** — Every try/catch should return a safe response
- **Log errors with context** — Include commandName, parameters, and error details
- **Write integration tests** — Full interaction → response cycle
- **Use TypeScript types** — Leverage `Interaction` and `InteractionResponse` types

### ❌ Don't

- **Call other commands** — Extract shared logic to a service instead
- **Mutate global state** — Use objectStorage for persistence
- **Make blocking calls in series** — Use Promise.all() for concurrent calls
- **Return raw errors to users** — Always catch and translate to user-friendly messages
- **Skip tests** — Coverage targets are 85% for commands

---

## Command Examples

### Example 1: Simple Response

```typescript
// src/commands/ping.ts
export async function handlePing(): Promise<InteractionResponse> {
  return {
    type: 4,
    data: { content: 'Pong!' },
  };
}
```

### Example 2: With Service Integration

```typescript
// src/commands/reddit.ts
import { redditService } from '../services/redditService';

export async function handleReddit(
  interaction: Interaction
): Promise<InteractionResponse> {
  try {
    const subreddit = interaction.data?.options?.[0]?.value;
    const post = await redditService.fetchRandomPost(subreddit);

    return {
      type: 4,
      data: { content: `📖 ${post.title}\n${post.url}` },
    };
  } catch (error) {
    console.error('[reddit] Error:', error);
    return {
      type: 4,
      data: { content: 'Failed to fetch Reddit post.' },
    };
  }
}
```

### Example 3: With Deferred Response

For long-running operations, defer the response:

```typescript
// Respond immediately
return {
  type: InteractionResponseType.DeferredChannelMessageWithSource,
};

// Follow up later (requires additional API call)
await discordService.updateInteractionResponse({
  content: 'Here is your result...',
});
```

---

## Checklist: Before Submitting

- [ ] Command handler created in `src/commands/{name}.ts`
- [ ] Handler registered in `src/commands.ts`
- [ ] Integration test written in `test/e2e/commands/{name}.test.ts`
- [ ] `npm run build` passes (type check, lint, all tests)
- [ ] Coverage is ≥85% for command logic
- [ ] Error messages are user-friendly
- [ ] Documentation is updated (ARCHITECTURE.md, etc.)
- [ ] No circular imports or rule violations (see [architecture-rules.md](./architecture-rules.md))

---

## References

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — System design
- [docs/design-docs/architecture-rules.md](./architecture-rules.md) — Import and naming rules
- [docs/design-docs/testing.md](./testing.md) — Test patterns and coverage
- [docs/references/error-messages.md](../references/error-messages.md) — Common errors and fixes
