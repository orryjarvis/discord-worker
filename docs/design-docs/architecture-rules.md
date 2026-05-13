# Design: Architecture Rules

This document defines the rules that enforce clean architecture in discord-worker. These rules are checked by linters, tests, and code review.

---

## Import Rules

### Rule 1: Commands Cannot Import from Other Commands

**Rationale:** Commands are independent handlers; cross-command dependencies create coupling.

```typescript
// ✅ Good
import { redditService } from '../services/redditService';

// ❌ Bad
import { someLogic } from '../commands/counter';
```

**How to fix:** Extract shared logic to a service or utility.

---

### Rule 2: Services Cannot Import from Commands

**Rationale:** Services are reusable; commands are consumers. Reverse dependency = architectural inversion.

```typescript
// ✅ Good (service)
export const redditService = {
  fetchPost: async () => { /* ... */ }
};

// ❌ Bad (service)
import { counterHandler } from '../commands/counter';
```

**How to fix:** If services need to share logic, create a shared utility or sub-service.

---

### Rule 3: All Imports Must Be Relative Paths Within `src/`

**Rationale:** Ensures imports are explicit and traceable; no implicit barrel files.

```typescript
// ✅ Good
import { redditService } from '../services/redditService';

// ❌ Bad
import { redditService } from 'src/services';
```

---

### Rule 4: No Circular Imports

**Rationale:** Circular imports cause initialization order bugs and complicate testing.

```typescript
// ✅ Good
A imports B
B imports C
C does not import A or B

// ❌ Bad
A imports B
B imports A
```

**How to fix:** Extract common dependencies to a third module; one module should not import the other.

---

## File & Naming Rules

### Rule 5: Command Files Go in `src/commands/`

**Pattern:** `src/commands/{commandName}.ts`

```typescript
// ✅ Good
src/commands/reddit.ts
src/commands/counter.ts

// ❌ Bad
src/reddit.ts
src/handlers/reddit.ts
```

---

### Rule 6: Service Files Go in `src/services/`

**Pattern:** `src/services/{serviceName}Service.ts`

```typescript
// ✅ Good
src/services/redditService.ts
src/services/objectStorage.ts

// ❌ Bad
src/services/reddit.ts
src/reddit-service.ts
```

---

### Rule 7: Type Definitions Go in `src/types/`

**Pattern:** `src/types/{domain}Types.ts`

```typescript
// ✅ Good
src/types/commandTypes.ts

// ❌ Bad
src/types/CommandTypes.ts
src/types/command.types.ts
```

**Exception:** Inline type definitions in `.ts` files if used only in that file.

---

### Rule 8: Test Files Mirror Source Structure

**Pattern:** `test/{source_path}.test.ts` and `test/e2e/{source_path}.test.ts`

```typescript
// ✅ Good
test/basic.test.ts            (unit test for src/basic.ts if it exists)
test/e2e/commands/reddit.test.ts  (e2e test for src/commands/reddit.ts)

// ❌ Bad
test/reddit_test.ts
test/reddit.spec.ts
```

---

## Module Responsibility Rules

### Rule 9: Each Command Has a Single Handler Function or Class

**Pattern:**

```typescript
// src/commands/reddit.ts
export async function handleReddit(interaction: Interaction) {
  // Command logic here
}
```

**Why:** Clarity; each command file has one purpose.

---

### Rule 10: Each Service Exports a Single Default Export or Named Exports

**Pattern:**

```typescript
// src/services/redditService.ts
export const redditService = {
  fetchPost: async () => { /* ... */ },
  authorize: async () => { /* ... */ }
};

// OR

export class RedditService {
  async fetchPost() { /* ... */ }
}
```

**Why:** Consistency; clear what each service provides.

---

## Testing Rules

### Rule 11: Test Files Are Colocated with Logic or in `test/` Mirror Structure

**Pattern:**

```
src/commands/reddit.ts
test/e2e/commands/reddit.test.ts

src/services/redditService.ts
test/services/redditService.test.ts (optional; can be in test/ root)
```

---

### Rule 12: Each Command Must Have an Integration Test

**Location:** `test/e2e/commands/{commandName}.test.ts`

**Covers:** Full interaction flow; command invocation, service calls, response generation.

---

### Rule 13: Each Service Must Have Unit Tests

**Location:** `test/services/{serviceName}.test.ts` or inline in `test/basic.test.ts`

**Covers:** Service logic, error handling, edge cases.

---

## Error Handling Rules

### Rule 14: All Errors Must Be Caught and Logged

**Pattern:**

```typescript
try {
  const result = await externalAPI.call();
} catch (error) {
  logger.error('Failed to call API', { error, context });
  return { error: 'User-friendly message' };
}
```

**Why:** Unhandled exceptions crash the worker; logging enables debugging.

---

### Rule 15: Service Errors Must Be Descriptive

**Pattern:**

```typescript
throw new Error('RedditService: Failed to fetch post; API returned 403');
```

**Why:** Error messages must help agents (and humans) diagnose and self-correct.

See [docs/design-docs/error-handling.md](./error-handling.md) for details.

---

## How to Verify Compliance

### Local Validation

```bash
npm run check    # TypeScript; catches import errors
npm run lint     # ESLint; catches naming/style violations
npm test         # Unit tests; validates logic
npm run e2e      # E2E tests; validates integration
```

### Automated Enforcement

*(Phase 4a: to be implemented)*

- `scripts/lint-architecture.ts` — Validates import graph, file naming, module structure
- `test/architecture.test.ts` — Structural tests (e.g., all commands in `src/commands/`, all have tests)
- CI job: `architecture` — Blocks PR merge if rules are violated

---

## References

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — System design
- [docs/references/error-messages.md](../references/error-messages.md) — Common lint errors and fixes
