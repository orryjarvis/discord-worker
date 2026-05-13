# References: Local Development

This guide teaches you how to build, test, lint, and validate discord-worker locally. It's designed for both human developers and AI agents who need to self-correct before requesting review.

---

## Quick Start

```bash
# Install dependencies
npm install

# Check types
npm run check

# Lint
npm run lint

# Run tests
npm test

# Run end-to-end tests
npm run e2e

# Run everything (build)
npm run build

# Deploy to Cloudflare
npm run deploy
```

---

## Full Command Reference

### Type Checking: `npm run check`

**Purpose:** Verify TypeScript types are correct; catch type errors before runtime.

```bash
npm run check
```

**Output (success):**

```
$ tsc --noEmit

# No output = success
```

**Output (failure):**

```
src/commands/reddit.ts:15:3 - error TS2339: Property 'fetchPost' does not exist on type 'RedditService'.
TS2339: Property 'fetchPost' does not exist on type 'RedditService'.
     15   const post = await redditService.fetchPost(subreddit);
```

**How to fix:**

1. Read the error message; identify the line number
2. Open the file at that line
3. Check the function/property name is spelled correctly
4. Check the import path is correct
5. Check the exported type definition matches

See [docs/references/error-messages.md](./error-messages.md) for common TypeScript errors.

---

### Linting: `npm run lint`

**Purpose:** Check code style, naming conventions, and architectural rules.

```bash
npm run lint
```

**Output (success):**

```
# No output = success
```

**Output (failure):**

```
  1:1  error  'console.log' used. Allowed debugger: console.{debug, error, info, log, warn}  no-console

/src/commands/reddit.ts
  42:5  error  'redditService' is imported but never used  no-unused-vars
```

**How to fix:**

1. Open the file at the line number
2. Read the rule name (e.g., `no-console`)
3. Check the linting rule documentation or [docs/references/error-messages.md](./error-messages.md)
4. Fix the code
5. Re-run `npm run lint` to verify

---

### Testing: `npm test`

**Purpose:** Run unit and integration tests; verify logic is correct.

```bash
# Run all tests
npm test

# Run specific file
npm test test/e2e/commands/reddit.test.ts

# Run with coverage report
npm test -- --coverage

# Run in watch mode (re-run on file change)
npm test -- --watch
```

**Output (success):**

```
 ✓ test/basic.test.ts (5 tests) 1234ms
 ✓ test/e2e/commands/reddit.test.ts (3 tests) 567ms

 Test Files  2 passed (2)
 Tests  8 passed (8)
 Duration  1.8s
```

**Output (failure):**

```
 ✗ test/e2e/commands/reddit.test.ts > should return formatted post

AssertionError: expected "Error: Unknown command" to contain "Great Post"
 ❯ test/e2e/commands/reddit.test.ts:18:5
    16:    const response = await handleReddit(interaction);
    17:
    18:    expect(response.data?.content).toContain('Great Post');

Expected: "Error: Unknown command"
Received: "Error: Unknown command"
```

**How to fix:**

1. Read the test name and file
2. Open the test file and review the test logic
3. Run the test in isolation: `npm test -- --reporter=verbose test/e2e/commands/reddit.test.ts`
4. Check the actual vs. expected value
5. Debug the code being tested (use `console.log()` or a debugger)
6. Fix the code or test
7. Re-run `npm test` to verify

See [docs/references/error-messages.md](./error-messages.md) for common test failures.

---

### E2E Testing: `npm run e2e`

**Purpose:** Test full request/response cycle; verify bot behaves end-to-end.

```bash
npm run e2e
```

**Output:**

Same as `npm test`, but runs only E2E tests (subset of all tests).

---

### Build (All Checks): `npm run build`

**Purpose:** Run type check → lint → tests → e2e in sequence; fails fast on first error.

```bash
npm run build
```

**Runs in order:**

1. Type check (`npm run check`)
2. Lint (`npm run lint`)
3. Unit tests (`npm test`)
4. E2E tests (`npm run e2e`)

**Use this before pushing or requesting review** to catch all issues locally.

---

## Understanding Test Coverage

```bash
npm test -- --coverage
```

**Output:**

```
────────────────────────────────────────────────────────────────────────
File                      | % Stmts | % Branch | % Funcs | % Lines |
────────────────────────────────────────────────────────────────────────
All files                 |   75.2  |   68.1   |   82.3  |   75.1  |
 src/                     |   80.0  |   75.0   |   85.0  |   80.0  |
  commands/reddit.ts      |   90.0  |   85.0   |   95.0  |   90.0  |
  services/redditSrv.ts   |   75.0  |   65.0   |   80.0  |   75.0  |
────────────────────────────────────────────────────────────────────────
```

**Understanding the columns:**

| Column | Meaning |
|--------|---------|
| `% Stmts` | Percentage of code statements executed by tests |
| `% Branch` | Percentage of if/else branches covered |
| `% Funcs` | Percentage of functions called by tests |
| `% Lines` | Percentage of lines executed by tests |

**Target thresholds (see [QUALITY.md](../../QUALITY.md)):**

- Commands: 85%
- Services: 80%
- Core: 90%
- Overall: 75%

**If coverage is below target:**

1. Run coverage report: `npm test -- --coverage`
2. Open `coverage/index.html` in browser to see which lines are uncovered
3. Add tests for uncovered code
4. Re-run coverage to verify threshold is met

---

## Interpreting Error Messages

### TypeScript Errors

```
src/commands/reddit.ts:15:3 - error TS2339: Property 'fetchPost' does not exist on type 'RedditService'.
```

**Read as:**

- File: `src/commands/reddit.ts`
- Line: 15, Column: 3
- Error code: `TS2339`
- Message: Property 'fetchPost' does not exist

**Fix:** Check the property exists on RedditService; check spelling and imports.

### Lint Errors

```
src/commands/reddit.ts:42:5  error  'redditService' is imported but never used  no-unused-vars
```

**Read as:**

- File: `src/commands/reddit.ts`
- Line: 42, Column: 5
- Rule: `no-unused-vars`
- Message: Variable imported but not used

**Fix:** Either use the variable or remove the import.

### Test Failures

```
 ✗ test/e2e/commands/reddit.test.ts > should return formatted post

AssertionError: expected "❌ Failed to fetch post" to contain "Great Post"
```

**Read as:**

- Test file: `test/e2e/commands/reddit.test.ts`
- Test name: "should return formatted post"
- Expected: "Great Post"
- Received: "❌ Failed to fetch post"

**Fix:** Investigate why the command returned an error instead of the expected post.

---

## Debugging Tips

### Using `console.log()`

```typescript
// src/commands/reddit.ts
export async function handleReddit(interaction: Interaction) {
  console.log('Received interaction:', interaction); // Debug
  const subreddit = interaction.data?.options?.[0]?.value;
  console.log('Subreddit:', subreddit); // Debug
  // ...
}
```

Run test with verbose output:

```bash
npm test -- --reporter=verbose
```

### Using Node Debugger

```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs run test/basic.test.ts
```

Opens debugger in Chrome DevTools (chromium://inspect).

### Isolate a Single Test

```bash
npm test -- test/e2e/commands/reddit.test.ts -t "should return formatted post"
```

### Run with Extra Logging

```bash
npm test -- --reporter=verbose test/basic.test.ts
```

---

## Common Workflows

### I Just Made a Change; What Do I Run?

1. **Type check:** `npm run check` (fast; catch type errors)
2. **Lint:** `npm run lint` (fast; catch style/import errors)
3. **Test:** `npm test -- --watch` (watch mode re-runs on changes)
4. **Full build:** `npm run build` (before pushing; runs everything)

### My Test Is Failing; How Do I Debug?

1. Run the test: `npm test -- --reporter=verbose test/file.test.ts`
2. Read the error message carefully
3. Open the test file and review the test logic
4. Add `console.log()` to the code being tested
5. Re-run the test and check the output
6. Fix the code
7. Re-run the test to verify

### My Lint Error Doesn't Make Sense

1. Re-read the error message
2. Check [docs/references/error-messages.md](./error-messages.md) for explanation
3. Check the lint rule documentation (usually linked in error)
4. Fix the code per the rule's guidance

### I Want to Add a New Command; What's the Checklist?

1. Create `src/commands/{commandName}.ts`
2. Register in `src/commands.ts`
3. Write test in `test/e2e/commands/{commandName}.test.ts`
4. Run `npm run check` (type check)
5. Run `npm run lint` (check naming, imports)
6. Run `npm test` (run tests)
7. Run `npm run build` (full check before pushing)
8. Update [docs/design-docs/commands.md](../design-docs/commands.md) if needed

See [docs/design-docs/commands.md](../design-docs/commands.md) for full guide.

---

## References

- [docs/references/error-messages.md](./error-messages.md) — Catalog of common errors
- [docs/design-docs/testing.md](../design-docs/testing.md) — Testing patterns
- [vitest.config.ts](../../vitest.config.ts) — Test configuration
- [package.json](../../package.json) — Scripts and dependencies
