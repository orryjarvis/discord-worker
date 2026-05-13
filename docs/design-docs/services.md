# Design: Adding a Service

This guide teaches you how to add a new service to discord-worker. Services encapsulate integration with external systems (APIs, databases, etc.) and are consumed by commands.

---

## What Is a Service?

A service:

- Encapsulates integration with a single external system (API, database, etc.)
- Exports functions or methods for that integration
- Is independent (does not depend on other services)
- Is consumed by commands (via factory or direct import)
- Has unit tests

**Pattern:**

```typescript
// src/services/myService.ts

export const myService = {
  async doSomething() { /* ... */ },
  async doAnotherThing() { /* ... */ },
};
```

---

## Anatomy of a Service

```typescript
// src/services/exampleService.ts

interface ExternalAPIResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export const exampleService = {
  /**
   * Fetch data from external API.
   * @param id - Resource ID
   * @returns Resource data or throws on error
   */
  async fetchResource(id: string): Promise<unknown> {
    const url = `https://api.example.com/resource/${id}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `ExampleService: Failed to fetch resource ${id}; API returned ${response.status}`
      );
    }

    const data = (await response.json()) as ExternalAPIResponse;
    if (!data.success) {
      throw new Error(`ExampleService: ${data.error}`);
    }

    return data.data;
  },
};
```

---

## Step-by-Step: Add a Service

### 1. Create the Service File

**File:** `src/services/{serviceName}Service.ts`

```typescript
interface APIResponse {
  // Define shape of external API response
}

export const {serviceName}Service = {
  /**
   * Description of what this method does.
   * @param param - Parameter description
   * @returns Return value description
   */
  async methodName(param: string): Promise<unknown> {
    try {
      // Call external API
      const response = await fetch(`https://api.example.com/...`);

      if (!response.ok) {
        throw new Error(
          `{ServiceName}Service: Request failed with status ${response.status}`
        );
      }

      const data = (await response.json()) as APIResponse;
      return data;
    } catch (error) {
      throw new Error(`{ServiceName}Service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};
```

### 2. Export from Factory (Optional)

If your service requires dependency injection, add it to `src/factory.ts`:

```typescript
// src/factory.ts
import { {serviceName}Service } from './services/{serviceName}Service';

export function createServices() {
  return {
    // ...
    {serviceName}Service,
  };
}
```

### 3. Use from Commands

```typescript
// src/commands/mycommand.ts
import { {serviceName}Service } from '../services/{serviceName}Service';

export async function handleMyCommand(interaction: Interaction) {
  const result = await {serviceName}Service.methodName('param');
  // ...
}
```

### 4. Write Unit Tests

**Location:** `test/services/{serviceName}.test.ts` or `test/basic.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { {serviceName}Service } from '../../src/services/{serviceName}Service';

describe('{serviceName}Service', () => {
  it('should fetch data successfully', async () => {
    // Mock external API
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'result' }),
    });

    const result = await {serviceName}Service.methodName('test');
    expect(result).toBe('result');
  });

  it('should throw on API error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect({serviceName}Service.methodName('test')).rejects.toThrow();
  });
});
```

### 5. Validate Locally

```bash
npm run check    # Type check
npm run lint     # Lint
npm test         # Unit + integration tests
npm run e2e      # End-to-end tests
```

### 6. Update Documentation

Update [ARCHITECTURE.md](../../ARCHITECTURE.md):

```markdown
| `src/services/{serviceName}Service.ts` | Integrates with {External System} |
```

---

## Service Best Practices

### ✅ Do

- **Keep it focused** — One service, one external system
- **Handle errors explicitly** — Throw with descriptive messages
- **Type API responses** — Define interfaces for external data shapes
- **Test with mocks** — Mock fetch/API calls; don't test external APIs
- **Document parameters and returns** — Use JSDoc comments
- **Use consistent naming** — `{serviceName}Service.ts`
- **Write unit tests** — Coverage target: 80%
- **Be stateless** — Services should not hold mutable state (use objectStorage for persistence)

### ❌ Don't

- **Depend on other services** — If two services share logic, extract to a utility
- **Call commands** — Services are agnostic; commands compose them
- **Make blocking calls in series** — Use Promise.all() for concurrent calls
- **Hardcode secrets** — Use environment variables or objectStorage
- **Log sensitive data** — Sanitize API responses before logging
- **Skip error handling** — Always catch and throw descriptive errors

---

## Service Examples

### Example 1: Simple HTTP API Integration

```typescript
// src/services/weatherService.ts
export const weatherService = {
  async getWeather(city: string): Promise<{ temp: number; condition: string }> {
    const url = `https://api.weather.com/forecast?city=${encodeURIComponent(city)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${process.env.WEATHER_API_KEY}` },
    });

    if (!response.ok) {
      throw new Error(`WeatherService: Failed to fetch weather; API returned ${response.status}`);
    }

    const data = await response.json();
    return { temp: data.temp_c, condition: data.condition };
  },
};
```

### Example 2: External System with State

```typescript
// src/services/oauthService.ts
import { objectStorage } from './objectStorage';

export const oauthService = {
  async authorize(code: string, userId: string): Promise<string> {
    const response = await fetch('https://oauth.provider.com/token', {
      method: 'POST',
      body: JSON.stringify({ code, client_id: process.env.OAUTH_CLIENT_ID }),
    });

    const token = await response.json();

    // Store token for later use
    await objectStorage.set(`token:${userId}`, token);

    return token.access_token;
  },

  async getStoredToken(userId: string): Promise<string | null> {
    const token = await objectStorage.get(`token:${userId}`);
    return token?.access_token || null;
  },
};
```

### Example 3: Service with Error Recovery

```typescript
// src/services/retryService.ts

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 400) {
        return response;
      }
      // Retry on 5xx errors
      if (response.status >= 500) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
        continue;
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

export const retryService = {
  async fetchWithRetry,
};
```

---

## Checklist: Before Submitting

- [ ] Service file created in `src/services/{name}Service.ts`
- [ ] Service exported (default or named export)
- [ ] Unit tests written in `test/basic.test.ts` or `test/services/{name}.test.ts`
- [ ] All tests pass: `npm run build`
- [ ] Coverage ≥80% for service logic
- [ ] Error messages are descriptive (cite service name and reason)
- [ ] JSDoc comments document all public methods
- [ ] No circular imports (see [architecture-rules.md](./architecture-rules.md))
- [ ] ARCHITECTURE.md updated with service description
- [ ] No hardcoded secrets (use env vars or objectStorage)

---

## References

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — System design, service table
- [docs/design-docs/architecture-rules.md](./architecture-rules.md) — Import and naming rules
- [docs/design-docs/testing.md](./testing.md) — Test patterns and mocking strategies
- [docs/references/code-patterns.md](../references/code-patterns.md) — Async patterns, error handling
