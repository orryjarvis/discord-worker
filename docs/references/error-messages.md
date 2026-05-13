# References: Error Messages Catalog

This document catalogs common errors you'll encounter when developing discord-worker, what they mean, and how to fix them.

---

## TypeScript Errors

### TS2339: Property Does Not Exist

```
src/commands/reddit.ts:15:3 - error TS2339: Property 'fetchPost' does not exist on type 'RedditService'.
```

**What it means:** You're trying to access a property or method that doesn't exist on the object.

**Common causes:**

- Typo in property name
- Property not exported from service
- Wrong import path

**How to fix:**

1. Check the spelling of the property: `fetchPost` vs `fetch_post` vs `FetchPost`
2. Check the service export: Does `redditService` actually export this method?
3. Check the import: `import { redditService } from '../services/redditService'`
4. Check the service file exists at that path

**Example:**

```typescript
// ❌ Wrong
await redditService.fetchPosts(subreddit); // Method doesn't exist

// ✅ Fix
await redditService.fetchPost(subreddit); // Correct method name
```

---

### TS2307: Cannot Find Module

```
src/commands/reddit.ts:1:26 - error TS2307: Cannot find module '../services/redditService' or its corresponding type declarations.
```

**What it means:** The import path doesn't exist or is incorrect.

**Common causes:**

- Wrong file path
- File doesn't exist
- Typo in filename

**How to fix:**

1. Check the file exists: `ls -la src/services/redditService.ts`
2. Check the path is correct (relative from the importing file)
3. Check the filename is exact (case-sensitive on Linux/Mac)

**Example:**

```typescript
// ❌ Wrong
import { redditService } from '../services/redditservice'; // Lowercase 's'

// ✅ Fix
import { redditService } from '../services/redditService'; // Correct case
```

---

### TS2345: Argument of Type Is Not Assignable

```
src/commands/reddit.ts:42:9 - error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
```

**What it means:** You're passing the wrong type to a function.

**Common causes:**

- Passing `null` or `undefined` when function expects a value
- Type mismatch (string vs number, etc.)

**How to fix:**

1. Check the function signature: What type does it expect?
2. Check what you're passing: Is it guaranteed to be that type?
3. Add type guards or default values

**Example:**

```typescript
// ❌ Wrong
const subreddit = interaction.data?.options?.[0]?.value; // Could be undefined
const post = await redditService.fetchPost(subreddit); // Function expects string

// ✅ Fix
const subreddit = interaction.data?.options?.[0]?.value ?? 'typescript'; // Default if undefined
const post = await redditService.fetchPost(subreddit);
```

---

### TS2322: Type Is Not Assignable to Type

```
src/commands/reddit.ts:55:3 - error TS2322: Type '{ type: number; data: { content: string; flags: number; }; }' is not assignable to type 'InteractionResponse'.
```

**What it means:** Object shape doesn't match expected type.

**Common causes:**

- Missing required properties
- Extra properties not allowed
- Wrong value types

**How to fix:**

1. Check the expected type definition
2. Compare your object to the type
3. Add or remove properties

**Example:**

```typescript
// ❌ Wrong (missing 'type')
return {
  data: { content: 'Hello' },
};

// ✅ Fix
return {
  type: 4, // InteractionResponseType.ChannelMessageWithSource
  data: { content: 'Hello' },
};
```

---

## Lint Errors

### no-console

```
src/commands/reddit.ts:42:5  error  'console.log' used. Allowed debugger: console.{debug, error, info, log, warn}  no-console
```

**What it means:** You used `console.log()`, which is not allowed in production code.

**Why:** Production logs should use structured logging.

**How to fix:**

- For debugging: Use `console.debug()`
- For errors: Use `console.error()`
- For warnings: Use `console.warn()`
- For info: Use `console.info()`

**Example:**

```typescript
// ❌ Wrong
console.log('Fetching post');

// ✅ Fix
console.debug('[reddit] Fetching post'); // For debugging
console.info('[reddit] Successfully fetched post'); // For info
console.error('[reddit] Failed to fetch post', { error }); // For errors
```

---

### no-unused-vars

```
src/commands/reddit.ts:5:9  error  'redditService' is imported but never used  no-unused-vars
```

**What it means:** You imported something but didn't use it.

**How to fix:**

- Use the import
- Remove the import if it's not needed

**Example:**

```typescript
// ❌ Wrong
import { redditService } from '../services/redditService';

export async function handleReddit() {
  // ... doesn't use redditService
}

// ✅ Fix
import { redditService } from '../services/redditService';

export async function handleReddit() {
  const post = await redditService.fetchPost('typescript');
}
```

---

### import/no-cycle (Circular Import)

```
src/commands/reddit.ts: Circular dependency detected: commands/reddit.ts → services/redditService.ts → commands/reddit.ts
```

**What it means:** Two files import from each other, creating a circular dependency.

**Why:** Circular imports cause initialization bugs and are hard to debug.

**How to fix:**

1. Identify the cycle (shown in error)
2. Extract shared code to a third file
3. Both files import the third file (no cycle)

**Example:**

```typescript
// ❌ Wrong (circular)
// src/commands/reddit.ts imports from services/redditService
// src/services/redditService imports from commands/reddit

// ✅ Fix (extract to utility)
// src/utils/redditHelpers.ts - shared logic
// src/commands/reddit.ts imports from utils
// src/services/redditService.ts imports from utils
```

---

### import/order (Import Order)

```
src/commands/reddit.ts:3:1  error  Expected imports to be in this order:
  1. import … from 'module'
  2. import … from '@scope/package'
  3. import … from 'relative'
```

**What it means:** Imports are in the wrong order (external, then relative).

**How to fix:**

1. Put external imports (`from 'discord-api-types'`) first
2. Put internal imports (`from '../services'`) after

**Example:**

```typescript
// ❌ Wrong (relative imports first)
import { redditService } from '../services/redditService';
import { Interaction } from 'discord-api-types/v10';

// ✅ Fix (external first)
import { Interaction } from 'discord-api-types/v10';
import { redditService } from '../services/redditService';
```

---

## Test Failures

### AssertionError: expected X to contain Y

```
AssertionError: expected "❌ Failed to fetch post" to contain "Great Post"
 ❯ test/e2e/commands/reddit.test.ts:18:5
    16:    const response = await handleReddit(interaction);
    17:
    18:    expect(response.data?.content).toContain('Great Post');
```

**What it means:** The actual value is different from what you expected.

**How to fix:**

1. Check the test logic: Is the mock set up correctly?
2. Check the command logic: Is it calling the right service?
3. Add debug logging to see what's happening
4. Fix the code or test

**Example:**

```typescript
// Test
it('should return formatted post', async () => {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: { title: 'Great Post' } }),
  });

  const response = await handleReddit(createMockInteraction('reddit'));

  // If this fails, add logging:
  console.log('Response:', response); // What did we actually get?
  expect(response.data?.content).toContain('Great Post');
});
```

---

### TypeError: Cannot Read Property

```
TypeError: Cannot read properties of undefined (reading 'json')
  at async redditService.fetchPost (src/services/redditService.ts:42)
```

**What it means:** You tried to access a property on something that doesn't exist (null/undefined).

**Common causes:**

- Object is undefined
- Expected a property that doesn't exist
- Forgot to unwrap optional chaining

**How to fix:**

1. Check the value exists before accessing it
2. Use optional chaining (`?.`)
3. Use default values (`??`)

**Example:**

```typescript
// ❌ Wrong
const data = response.json(); // response might be undefined

// ✅ Fix
const response = await fetch(url);
if (!response) throw new Error('No response');
const data = await response.json();

// ✅ Or with optional chaining
const data = await response?.json(); // Safe; returns undefined if response is undefined
```

---

### Test Timeout

```
TimeoutError: Test timed out in 5000ms.
```

**What it means:** The test took longer than the timeout (usually 5s).

**Common causes:**

- Infinite loop
- Forgot to await a promise
- Mock not set up (test waits for real API call)
- Service call is slow

**How to fix:**

1. Check the test is awaiting promises: `await asyncFunction()`
2. Check mocks are set up: `global.fetch = vi.fn().mockResolvedValueOnce(...)`
3. Add logging to see where it's stuck
4. Increase timeout for long-running tests (if legitimate)

**Example:**

```typescript
// ❌ Wrong (forgot await)
const response = handleReddit(interaction); // Forgot await
await expect(response).resolves.toBeDefined();

// ✅ Fix
const response = await handleReddit(interaction);
expect(response).toBeDefined();
```

---

## Coverage Issues

### Coverage Below Threshold

```
  File                 | % Stmts | % Branch | % Funcs | % Lines |
  ─────────────────────┼─────────┼──────────┼─────────┼─────────┤
  src/commands/         |   75%   |   65%    |   70%   |   75%   | (target: 85%)
```

**What it means:** Your code isn't tested enough.

**How to fix:**

1. Run coverage: `npm test -- --coverage`
2. Open `coverage/index.html` and find uncovered lines
3. Write tests for those lines
4. Re-run coverage

**Common missing coverage:**

- Error cases (try/catch blocks)
- Edge cases (null, empty input)
- Conditional branches (if/else)

**Example:**

```typescript
// src/commands/reddit.ts
export async function handleReddit(interaction: Interaction) {
  try {
    const subreddit = interaction.data?.options?.[0]?.value ?? 'typescript';
    // Line above: not tested if value exists

    const post = await redditService.fetchPost(subreddit);
    return { type: 4, data: { content: post.title } };
  } catch (error) {
    // Line above: error case not tested
    return { type: 4, data: { content: 'Error' } };
  }
}

// test/e2e/commands/reddit.test.ts
it('should handle missing subreddit', () => {
  // Add test for missing subreddit parameter
  const interaction = { data: { options: [] } };
  const response = handleReddit(interaction);
  // Verify it uses default 'typescript'
});

it('should handle API error', () => {
  // Add test for error case
  global.fetch = vi.fn().mockRejectedValueOnce(new Error('API down'));
  // Verify it returns error response
});
```

---

## Build Failures

### npm run build Fails

The `build` task runs: type check → lint → tests → e2e. If it fails, find which step:

```bash
npm run check  # If this fails, fix TypeScript errors
npm run lint   # If this fails, fix linting errors
npm test       # If this fails, fix test failures
npm run e2e    # If this fails, fix e2e failures
```

Each failure above has a section in this document.

---

## How to Read Error Messages

### Template

```
{Filename}:{Line}:{Column} - {ErrorLevel} {ErrorCode}: {Message}
```

**Example:**

```
src/commands/reddit.ts:15:3 - error TS2339: Property 'fetchPost' does not exist
```

- **Filename:** `src/commands/reddit.ts`
- **Line:** 15
- **Column:** 3
- **ErrorLevel:** error (or warn, info)
- **ErrorCode:** TS2339 (TypeScript error 2339)
- **Message:** Property 'fetchPost' does not exist

**Steps:**

1. Open file at line number
2. Read the error message
3. Look up error code in this document or error-messages.md
4. Apply the fix
5. Re-run the tool

---

## Getting Help

If an error isn't in this catalog:

1. **Read the error carefully** — Most error messages are self-explanatory
2. **Search the design docs** — Check [docs/design-docs/](../design-docs/)
3. **Check code examples** — Look at similar code in the codebase
4. **Search online** — TypeScript/ESLint errors are well-documented
5. **Ask in an issue** — Raise a question or request for this catalog

---

## References

- [docs/references/local-dev.md](./local-dev.md) — How to run commands locally
- [docs/design-docs/error-handling.md](../design-docs/error-handling.md) — Error handling patterns
- [docs/design-docs/testing.md](../design-docs/testing.md) — Testing patterns
