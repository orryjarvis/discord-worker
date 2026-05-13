# Design: Testing Strategy

This document defines testing practices, coverage expectations, and patterns for discord-worker.

---

## Overview

The project uses **Vitest** for all testing:

- **Unit tests** — Isolated logic (services, utilities)
- **Integration tests** — Components working together (commands + services)
- **End-to-end (E2E) tests** — Full request/response cycle with mocked Discord API

---

## Test Structure

```
test/
├── basic.test.ts              ← Unit tests for core logic
├── e2e/
│   ├── basic.test.ts          ← E2E tests for full flow
│   ├── commands/
│   │   ├── counter.test.ts    ← Integration tests for counter command
│   │   ├── reddit.test.ts
│   │   └── ...
│   ├── setup.shared.ts        ← Shared test utilities
│   ├── setup.e2e.ts           ← E2E test setup
│   ├── setup.smoke.ts         ← Smoke test setup
│   └── signAndSendRequest.ts  ← Request helpers
```

---

## Coverage Targets

| Domain | Target | Rationale |
|--------|--------|-----------|
| **Commands** | 85% | Core feature; high value-to-effort ratio |
| **Services** | 80% | Integrations; complex logic |
| **Core** (auth, app, factory) | 90% | Critical infrastructure; must be reliable |
| **Utilities** | 70% | Lower risk; smaller surface area |
| **Overall Project** | 75% | Safety net; ensures no major gaps |

**How to measure:**

```bash
npm test -- --coverage
```

See coverage report in terminal or `coverage/` directory.

---

## Unit Tests

**Purpose:** Test isolated functions and classes.

**Location:** `test/basic.test.ts` or `test/services/{serviceName}.test.ts`

**Pattern:**

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/utils';

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle edge case', () => {
    const result = myFunction('');
    expect(result).toBeNull();
  });

  it('should throw on invalid input', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

**Best Practices:**

- ✅ One assertion per test (or logically related assertions)
- ✅ Descriptive test names (`should...`)
- ✅ Test happy path, edge cases, and error cases
- ✅ Use mocks for external calls (see Service Mocking below)
- ❌ Don't share state between tests (use beforeEach/afterEach)

---

## Service Unit Tests & Mocking

**Purpose:** Test service logic without calling real APIs.

**Pattern:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { redditService } from '../../src/services/redditService';

describe('redditService', () => {
  it('should fetch post and return data', async () => {
    // Mock fetch to avoid real API call
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { children: [{ data: { title: 'Test Post', url: 'https://...' } }] },
      }),
    });

    const post = await redditService.fetchRandomPost('typescript');

    expect(post.title).toBe('Test Post');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('reddit.com/r/typescript')
    );
  });

  it('should throw on API error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(redditService.fetchRandomPost('typescript')).rejects.toThrow(
      /Failed to fetch/
    );
  });
});
```

**Mocking patterns:**

```typescript
// Mock fetch
global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });

// Mock environment variable
vi.stubEnv('API_KEY', 'test-key');

// Mock dependency
vi.mock('../src/services/externalService', () => ({
  externalService: { doSomething: vi.fn().mockResolvedValue('result') },
}));

// Reset after test
vi.resetAllMocks();
```

---

## Integration Tests (Commands)

**Purpose:** Test commands working with real services (mocked externals).

**Location:** `test/e2e/commands/{commandName}.test.ts`

**Pattern:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { handleReddit } from '../../../src/commands/reddit';
import { createMockInteraction } from '../setup.shared';

describe('handleReddit', () => {
  it('should return formatted post', async () => {
    // Mock external API
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { children: [{ data: { title: 'Great Post', url: 'https://...' } }] },
      }),
    });

    // Create interaction mock
    const interaction = createMockInteraction('reddit', {
      options: [{ name: 'subreddit', value: 'typescript' }],
    });

    // Execute command
    const response = await handleReddit(interaction);

    // Verify response
    expect(response.type).toBe(4); // ChannelMessageWithSource
    expect(response.data?.content).toContain('Great Post');
  });

  it('should handle missing subreddit parameter', async () => {
    const interaction = createMockInteraction('reddit'); // No options
    const response = await handleReddit(interaction);

    expect(response.data?.content).toContain('error') || 
      expect(response.data?.content).toContain('required');
  });

  it('should handle API failures gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const interaction = createMockInteraction('reddit', {
      options: [{ name: 'subreddit', value: 'typescript' }],
    });

    const response = await handleReddit(interaction);

    // Should return error response, not throw
    expect(response.type).toBe(4);
    expect(response.data?.content).toContain('error');
  });
});
```

**Test helpers in `test/e2e/setup.shared.ts`:**

```typescript
export function createMockInteraction(commandName: string, options?: any) {
  return {
    type: 2, // ApplicationCommand
    data: { name: commandName, ...options },
    member: { user: { id: '123456789' } },
  };
}
```

---

## End-to-End (E2E) Tests

**Purpose:** Test full request/response flow through the bot.

**Location:** `test/e2e/basic.test.ts`

**Pattern:**

```typescript
import { describe, it, expect } from 'vitest';
import { handleRequest } from '../../src/app';

describe('E2E: Full Bot Flow', () => {
  it('should process Discord interaction end-to-end', async () => {
    const request = createSignedRequest({
      type: 2,
      data: { name: 'ping' },
    });

    const response = await handleRequest(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.content).toContain('Pong');
  });

  it('should validate request signature', async () => {
    const request = createUnsignedRequest({
      type: 2,
      data: { name: 'ping' },
    });

    const response = await handleRequest(request);

    expect(response.status).toBe(401);
  });
});
```

---

## Running Tests Locally

```bash
# Run all tests
npm test

# Run specific file
npm test test/e2e/commands/reddit.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode (re-run on file change)
npm test -- --watch

# Run only E2E tests
npm run e2e
```

---

## Test Configuration

**File:** `vitest.config.ts`

Defines:
- Test environment (node, browser, etc.)
- Module resolution
- Coverage thresholds
- Test timeouts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 75,
      functions: 75,
      branches: 75,
      statements: 75,
    },
  },
});
```

---

## Best Practices

### ✅ Do

- **Test behavior, not implementation** — Assert on outputs, not internal state
- **Use descriptive names** — `should return user-friendly error message` not `should fail`
- **Isolate tests** — Each test runs independently; no shared state
- **Mock externals** — Never call real APIs in tests
- **Test edge cases** — Empty input, null, invalid types, network errors
- **Keep tests fast** — Use mocks; timeout individual tests at 5–10s
- **Group related tests** — Use `describe()` blocks
- **Update tests with code** — If you change logic, update tests

### ❌ Don't

- **Test implementation details** — Don't mock internal functions
- **Hardcode test data** — Use fixtures or factories
- **Test external APIs** — Mock them instead
- **Share state between tests** — Use beforeEach/afterEach
- **Skip flaky tests** — Fix them; use `.skip()` only temporarily
- **Test multiple concerns in one test** — One test = one behavior

---

## Debugging Tests

```bash
# Run with extra logging
npm test -- --reporter=verbose

# Run single test
npm test -- --reporter=verbose test/e2e/commands/reddit.test.ts

# Node debugging
node --inspect-brk ./node_modules/vitest/vitest.mjs run test/basic.test.ts
```

---

## Coverage Gaps

If coverage is below target:

```bash
npm test -- --coverage
```

Review `coverage/` directory HTML report to identify uncovered lines.

**Common causes:**

- Error cases not tested — Add tests for catch blocks
- Edge cases missed — Test null, empty, invalid inputs
- Service integration not mocked — Mock external APIs
- Complex branching — Test both if/else paths

---

## References

- [Vitest Documentation](https://vitest.dev)
- [docs/references/error-messages.md](../references/error-messages.md) — Common test failures
- [docs/design-docs/commands.md](./commands.md) — Command testing patterns
- [docs/design-docs/services.md](./services.md) — Service mocking patterns
