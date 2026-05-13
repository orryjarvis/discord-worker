# References: Glossary

This document defines terminology used in discord-worker documentation and code.

---

## Core Concepts

### Interaction

A Discord interaction is an event triggered when a user takes action (e.g., types a slash command, clicks a button). The bot receives an HTTP POST request with interaction data and must respond within 3 seconds.

**Related:** Slash Command, Response

---

### Slash Command

A Discord slash command (`/mycommand`) that a user can type in a channel or DM. Slash commands are defined in the Discord Developer Portal and handled by the bot via the Interactions API.

**Examples:** `/reddit`, `/counter`, `/react`

**Related:** Interaction, Handler

---

### Handler

A TypeScript function that processes a Discord interaction. Handlers are named `handle{CommandName}` and live in `src/commands/`.

**Example:**
```typescript
export async function handleReddit(interaction: Interaction): Promise<InteractionResponse> {
  // ...
}
```

**Related:** Command, Interaction

---

### Service

A module that encapsulates integration with an external system (API, database, etc.). Services are stateless and reusable; consumed by commands. Live in `src/services/`.

**Examples:** `redditService`, `discordService`, `objectStorage`

**Related:** Integration, Dependency

---

### Integration

Connection to an external system. Each service provides one integration (e.g., Reddit API).

**Examples:** Reddit API, Discord API, Cloudflare KV

**Related:** Service

---

## Architecture Concepts

### Dependency Injection (DI)

A pattern where components receive their dependencies (e.g., services) rather than creating them. In discord-worker, the factory (`src/factory.ts`) creates services and commands use them.

**Example:**
```typescript
// Commands depend on services
const redditPost = await redditService.fetchPost(subreddit);
```

**Related:** Factory, Loose Coupling

---

### Loose Coupling

Modules are independent and don't depend on internal details of other modules. Changes to one module don't break others.

**Example:** Commands don't import each other; they use services.

**Related:** Modularity, Service

---

### High Cohesion

Modules have a single, clear responsibility. All code in a module works toward that responsibility.

**Example:** `redditService` only handles Reddit API integration; it doesn't handle Discord responses.

**Related:** Separation of Concerns

---

### Separation of Concerns

Each module has a single responsibility (concern). Changes to one concern don't affect others.

**Examples:**
- Commands: handle Discord interactions
- Services: integrate with external systems
- Tests: verify logic

**Related:** High Cohesion, Modularity

---

## Discord Concepts

### User

A Discord user; identified by a unique ID (`userId`).

**Example:** `interaction.member?.user?.id`

---

### Guild (Server)

A Discord server. Interactions can occur in a guild or in DMs.

**Related:** Channel, User

---

### Channel

A Discord channel within a guild or a DM channel with a user.

**Related:** Guild

---

### Message

A text message sent to a channel. Commands often respond by sending messages.

**Related:** Interaction Response

---

### Interaction Response

The response sent back to Discord in reply to an interaction. Must be sent within 3 seconds of receiving the interaction.

**Types:**
- `ChannelMessageWithSource` (type 4) — Send a message to the channel
- `DeferredChannelMessageWithSource` (type 5) — Acknowledge immediately; send message later

**Related:** Interaction

---

### Ephemeral Message

A message visible only to the user who triggered the interaction. Uses the `Ephemeral` flag.

**Related:** Message, Interaction Response

---

## Development Concepts

### Test Coverage

Percentage of code executed by tests. Measured by number of lines, branches, functions executed.

**Targets:**
- Commands: 85%
- Services: 80%
- Core: 90%

**Related:** Test, Unit Test

---

### Unit Test

A test of a single function or class in isolation (with external dependencies mocked).

**Example:** Test `redditService.fetchPost()` with fetch mocked

**Related:** Test, Integration Test, E2E Test

---

### Integration Test

A test of multiple components working together (with external APIs mocked).

**Example:** Test command + service together; mock external API

**Related:** Test, Unit Test, E2E Test

---

### End-to-End (E2E) Test

A test of the full bot flow from receiving a Discord request to sending a response (with external APIs mocked).

**Example:** Create signed request → bot receives → bot processes → bot returns response

**Related:** Test, Integration Test

---

### Mock

A fake implementation of an external service (e.g., API call) used in tests. Mocks allow tests to run without calling real services.

**Example:** `vi.fn().mockResolvedValueOnce({ data: 'result' })`

**Related:** Stub, Test Double

---

### Linting

Automated checking of code style and quality. Errors are reported with file:line references.

**Tools:** ESLint

**Common rules:**
- `no-console` — Don't use console.log()
- `no-unused-vars` — Remove unused imports
- `import/order` — Order imports correctly

**Related:** Lint Error

---

### Type Checking

Automated checking that TypeScript types are correct. Errors are reported with file:line references.

**Tool:** TypeScript (`tsc`)

**Common errors:**
- `TS2339` — Property doesn't exist
- `TS2307` — Module not found
- `TS2345` — Wrong argument type

**Related:** Type Error

---

### CI/CD Pipeline

Automated checks and deployment on every push. Runs type check, lint, tests, e2e, and deploys on success.

**Related:** Deployment, GitHub Actions

---

## File & Directory Concepts

### src/

Source code directory. Contains all bot logic.

**Subdirectories:**
- `src/commands/` — Command handlers
- `src/services/` — External integrations
- `src/types/` — Type definitions

---

### test/

Test directory. Contains unit, integration, and e2e tests.

**Subdirectories:**
- `test/e2e/` — End-to-end tests
- `test/e2e/commands/` — Per-command e2e tests
- `test/e2e/setup.*.ts` — Test fixtures

---

### docs/

Documentation directory.

**Subdirectories:**
- `docs/design-docs/` — Design decisions and patterns
- `docs/references/` — Quick references and examples
- `docs/exec-plans/` — Execution plans and tech debt

---

## External Services & Platforms

### Discord API

The API for interacting with Discord (sending messages, validating requests, etc.).

**Related:** Interaction, User, Message

---

### Reddit API

The API for accessing Reddit data (posts, subreddits, etc.). Requires OAuth2 authentication.

**Related:** Service, Integration

---

### Dota 2 API (OpenDota)

The API for accessing Dota 2 game data.

**Related:** Service, Integration

---

### Cloudflare Workers

Serverless platform for running the bot. Executes JavaScript on edge servers worldwide.

**Related:** Deployment, Infrastructure

---

### Cloudflare KV

Distributed key-value store for persisting state (tokens, counters, etc.).

**Related:** Storage, State, Service

---

## Metrics & Monitoring

### Quality Gate

A check that must pass before code is merged. Examples: type check, lint, tests.

**Related:** CI/CD Pipeline, Quality

---

### Code Quality

Measure of code maintainability, correctness, and adherence to standards. Evaluated by type checking, linting, testing, and code review.

**Related:** Quality Gate, Coverage

---

### Coverage Threshold

Minimum percentage of code that must be tested. Set per domain (commands, services, core).

**Example:** Commands must have 85% coverage

**Related:** Code Quality, Test Coverage

---

## Other Terminology

### Harness Engineering

A disciplined approach to enabling AI agents (or teams) to make reliable, correct changes to a codebase. Involves: in-repo knowledge, targeted skills, workflows, and mechanical enforcement.

**Related:** Agent, AI

---

### Ralph Wiggum Loop

A feedback loop where agents validate changes locally and self-correct before requesting review. Named after the character "Ralph Wiggum" from The Simpsons.

**Steps:** Code → Run → Interpret → Fix → Repeat

**Related:** Local Validation, Feedback

---

### Agent

An AI system (e.g., GitHub Copilot) that can read, understand, and write code. Agents benefit from clear architecture, documentation, and enforcement rules.

**Related:** AI, Harness Engineering

---

## Quick Reference Table

| Term | Definition | Example |
|------|-----------|---------|
| **Interaction** | Discord event (e.g., slash command) | User types `/reddit` |
| **Handler** | Function that processes interaction | `handleReddit()` |
| **Service** | External integration (stateless) | `redditService` |
| **Command** | Slash command exposed to users | `/reddit` |
| **Unit Test** | Test single function in isolation | Test `fetchPost()` with mock |
| **Mock** | Fake external service | Mock `fetch()` to return test data |
| **Coverage** | % of code tested | 80% coverage |
| **Linting** | Automated code style check | ESLint checks naming |
| **Type Check** | Automated type correctness | TypeScript validates types |
| **CI/CD** | Automated checks + deployment | Run tests on every push |

---

## See Also

- [AGENTS.md](../../AGENTS.md) — Agent guide; start here
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — System design
- [docs/design-docs/](../design-docs/) — Design patterns
- [docs/references/](../references/) — Quick references
