# Architecture layering

This document records the current intentional layering used by the Worker.

The goal is to keep command logic independent from Discord payload shape while
preserving a small, direct codebase.

---

## Layers

- `app` (`src/app.ts`)
  - Discord-facing boundary.
  - Validates/verifies incoming HTTP requests.
  - Transforms Discord interaction payloads into flat app request types.
  - Calls dispatch and translates dispatch outcomes into Discord responses.

- `dispatch` (`src/dispatch.ts`)
  - Core routing logic.
  - Resolves command handlers by command name.
  - Returns command outcomes without Discord-specific formatting.

- `command` (`src/command.ts`)
  - Command definitions and implementations.
  - Returns domain results described by `core` interfaces.
  - Contains no Discord request/response schema knowledge.

- `core` (`src/core.ts`)
  - Shared request/result interfaces for app, dispatch, and command.
  - No external runtime dependencies.

---

## Dependency directions

Allowed dependencies:

- `app -> dispatch`
- `app -> command`
- `app -> core`
- `dispatch -> core`
- `command -> core`

Disallowed dependencies:

- `dispatch -> command`
- `command -> dispatch`
- Any dependency from lower layers into `app`

Entry point rule:

- `src/index.ts` stays a thin re-export of `src/app.ts`.

---

## Data flow

1. `app` receives Discord HTTP request.
2. `app` verifies signatures and parses interaction payload.
3. `app` transforms Discord payload to flat `core` request type.
4. `app` calls `dispatch` with request + command map.
5. `dispatch` routes to a command handler from `command`.
6. Command handler returns a `core` result.
7. `app` maps the result back to Discord response payloads and side effects.

---

## Scope notes

- This layering is intentionally lightweight: no plugin system, no service
  registry, no boundary-enforcement tooling yet.
- If import-boundary violations become a repeated issue, add mechanical
  enforcement (lint/import graph rules) in a separate change.
