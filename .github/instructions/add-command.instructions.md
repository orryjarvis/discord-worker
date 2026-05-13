---
applyTo: "src/commands/**/*.ts,test/e2e/commands/**/*.ts,src/commands.ts"
---

# Add Command Skill

Use this instruction set when creating or modifying slash command handlers.

## Primary References

- [AGENTS.md](../../AGENTS.md)
- [docs/design-docs/commands.md](../../docs/design-docs/commands.md)
- [docs/design-docs/architecture-rules.md](../../docs/design-docs/architecture-rules.md)
- [docs/design-docs/testing.md](../../docs/design-docs/testing.md)

## Required Workflow

1. Create or update a command in `src/commands/{name}.ts`.
2. Register command routing in `src/commands.ts`.
3. Add or update integration tests in `test/e2e/commands/{name}.test.ts`.
4. Validate with `npm run check`, `npm run lint`, and `npm test`.

## Implementation Rules

- Keep command handlers thin; move business logic to services.
- Validate interaction inputs before calling services.
- Return user-friendly failures; never return raw exceptions.
- Commands must not import other command files.

## Minimal Command Skeleton

```ts
import { Interaction, InteractionResponse } from 'discord-api-types/v10';

export async function handleExample(
  interaction: Interaction
): Promise<InteractionResponse> {
  try {
    const value = interaction.data?.options?.[0]?.value;
    if (typeof value !== 'string') {
      return { type: 4, data: { content: 'Invalid input' } };
    }

    return { type: 4, data: { content: `OK: ${value}` } };
  } catch (error) {
    console.error('[example] Error', { error });
    return { type: 4, data: { content: 'An error occurred.' } };
  }
}
```

## Definition of Done

- Command routes correctly from `src/commands.ts`.
- Integration tests cover success and error paths.
- No architecture-rule violations.
- Local checks pass before review.
