---
applyTo: "src/services/**/*.ts,src/factory.ts,test/**/*.test.ts"
---

# Add Service Skill

Use this instruction set when creating or changing service integrations.

## Primary References

- [AGENTS.md](../../AGENTS.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/design-docs/services.md](../../docs/design-docs/services.md)
- [docs/design-docs/error-handling.md](../../docs/design-docs/error-handling.md)

## Required Workflow

1. Add service file under `src/services/{name}Service.ts`.
2. Wire service through `src/factory.ts` when dependency injection is needed.
3. Add unit tests for success, failure, and edge cases.
4. Update architecture docs if a new external integration is introduced.

## Implementation Rules

- Services should encapsulate one external domain.
- Services must not import command modules.
- Throw descriptive errors with service context.
- Avoid mutable global state in services.

## Minimal Service Skeleton

```ts
export const exampleService = {
  async fetchThing(id: string): Promise<unknown> {
    try {
      const response = await fetch(`https://example.com/${id}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(
        `ExampleService: Failed to fetchThing; ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  },
};
```

## Definition of Done

- Service file follows naming and placement rules.
- Unit tests exist and isolate external calls via mocks.
- Error handling is explicit and actionable.
- Local checks pass before review.
