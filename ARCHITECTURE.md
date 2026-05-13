# Architecture: Discord Worker Bot

This document describes the high-level design of the discord-worker Discord bot, including module responsibilities, data flow, and dependency structure.

---

## System Overview

The discord-worker is a Cloudflare Workers-based Discord bot that:

- Receives command interactions from Discord
- Dispatches to command handlers (counter, reddit, react, invite, refresh)
- Integrates with external services (Discord API, Reddit API, Dota 2 API)
- Stores state in Cloudflare KV object storage
- Returns responses back to Discord

```
Discord API
    ↓
Cloudflare Worker (index.ts)
    ↓
    ├─→ Authentication & validation (auth.ts)
    ├─→ Command routing (commands.ts)
    ├─→ Command handlers (commands/*.ts)
    │   └─→ Service integrations (services/*.ts)
    └─→ KV storage (objectStorage.ts)
    ↓
Discord API
```

---

## Module Responsibilities

### Core

| Module | Responsibility |
|--------|-----------------|
| `src/index.ts` | Entry point; receives requests from Discord; routes to handlers |
| `src/auth.ts` | Validates Discord request signatures; verifies authenticity |
| `src/app.ts` | Request/response handling; serialization; error boundary |
| `src/commands.ts` | Command routing logic; dispatches interaction to handler |
| `src/factory.ts` | Dependency injection; creates service instances |
| `src/loader.ts` | Dynamic command registration; introspection |
| `src/types.ts` | Shared type definitions |

### Commands

Each command handler:
- Accepts a Discord Interaction
- Calls relevant services
- Returns an InteractionResponse
- Is registered in `src/commands.ts`

| Module | Purpose |
|--------|---------|
| `src/commands/counter.ts` | Simple in-memory counter for testing |
| `src/commands/invite.ts` | Generates bot invite link |
| `src/commands/reddit.ts` | Fetches and posts Reddit data |
| `src/commands/react.ts` | Adds emoji reactions to messages |
| `src/commands/refresh.ts` | Refreshes access tokens for external APIs |

### Services

Each service encapsulates integration with an external system:

| Module | Integrates With |
|--------|-----------------|
| `src/services/discordService.ts` | Discord API |
| `src/services/redditService.ts` | Reddit API (OAuth2) |
| `src/services/dotaService.ts` | Dota 2 API (OpenDota) |
| `src/services/reactService.ts` | Generic reaction/emoji handling |
| `src/services/objectStorage.ts` | Cloudflare KV (state persistence) |

### Testing

| Module | Scope |
|--------|-------|
| `test/basic.test.ts` | Unit tests for core logic |
| `test/e2e/` | End-to-end tests; full request/response cycle |
| `test/e2e/commands/` | Per-command integration tests |
| `test/e2e/setup.*.ts` | Test fixtures and environment setup |

---

## Data Flow: Command Execution

Example: User types `/reddit` in Discord

```
1. Discord sends Interaction webhook
          ↓
2. index.ts receives request
          ↓
3. auth.ts validates signature
          ↓
4. commands.ts parses interaction, identifies "reddit" command
          ↓
5. reddit.ts executes:
   - Calls factory to get redditService instance
   - Calls redditService.fetchPost()
   - Service queries Reddit API, handles OAuth
   - Returns InteractionResponse
          ↓
6. app.ts serializes response, sends back to Discord
          ↓
7. Discord displays result in channel
```

---

## Dependency Structure

### Dependency Rules

1. **Commands depend on Services, never the reverse** — Services are agnostic; commands compose them
2. **Services do not depend on other services** — Keep integrations orthogonal; compose in commands or factory
3. **No circular imports** — All imports form a DAG
4. **Types live in `src/types/`** — Shared types are centralized
5. **Utilities in `src/`** — Helpers (not domain-specific) stay at root level

### Import Constraints

| Source | May Import From |
|--------|-----------------|
| Commands (`src/commands/*.ts`) | Services, types, utilities, factory |
| Services (`src/services/*.ts`) | Other services (rarely), types, NO commands |
| Tests (`test/`) | Everything |
| Utilities (`src/auth.ts`, `src/app.ts`) | Types, other utilities |

---

## State & Persistence

### KV Object Storage

- **Provider:** Cloudflare KV (distributed key-value store)
- **Purpose:** Persist bot state across requests
- **Access:** Through `objectStorage.ts` service
- **Usage:** Token storage, counters, user-specific data

```typescript
// Example: store a user's Reddit access token
await objectStorage.set(userId, { redditToken: token });

// Retrieve it later
const data = await objectStorage.get(userId);
```

---

## Error Handling

- **Request validation errors** → Return Discord error interaction
- **Service call failures** → Log and return user-friendly error message
- **Type errors** → Caught at build time via TypeScript; linted pre-commit
- **Unhandled exceptions** → Logged; return generic error to user

See [docs/design-docs/error-handling.md](./docs/design-docs/error-handling.md) for detailed patterns.

---

## Testing Strategy

- **Unit tests** (`test/basic.test.ts`) — Core logic, handlers, services in isolation
- **Integration tests** (`test/e2e/commands/*.test.ts`) — Full command flow with mocked Discord API
- **End-to-end tests** (`test/e2e/basic.test.ts`) — Full request → response cycle
- **Smoke tests** (optional) — Validate live environment

See [docs/design-docs/testing.md](./docs/design-docs/testing.md) for patterns and coverage expectations.

---

## Deployment

- **Platform:** Cloudflare Workers
- **Configuration:** `wrangler.toml`
- **Secrets:** Managed via `wrangler secret` commands
- **Build:** TypeScript → JavaScript (via Wrangler)
- **Deployment:** `npm run deploy` or CI/CD automation

---

## Key Files & Entry Points

```
src/
├── index.ts              ← Discord webhook entry point
├── auth.ts               ← Request signature validation
├── app.ts                ← Request/response handling
├── commands.ts           ← Command routing
├── factory.ts            ← Dependency injection
├── loader.ts             ← Dynamic command loading
├── types.ts              ← Shared types
├── commands/             ← Individual command handlers
│   ├── counter.ts
│   ├── invite.ts
│   ├── reddit.ts
│   ├── react.ts
│   └── refresh.ts
├── services/             ← External integrations
│   ├── discordService.ts
│   ├── redditService.ts
│   ├── dotaService.ts
│   ├── reactService.ts
│   └── objectStorage.ts
└── types/
    └── commandTypes.ts   ← Command-related types
```

---

## Future Evolution

- **Modular command registry** — Load commands from config, not hard-coded
- **Plugin system** — Third-party command extensions
- **Distributed state** — Cross-worker coordination via Durable Objects
- **Advanced logging** — Structured logging to external service (not console)
