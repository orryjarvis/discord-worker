# Architecture layering

This document records the current intentional layering used by the Worker.

The goal is to keep skill logic independent from Discord payload shape while
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
  - Command skill definitions and implementations.
  - Returns domain results described by `core` interfaces.
  - Contains no Discord request/response schema knowledge.

- `scheduled` (`src/scheduled.ts`)
  - Scheduled skill dispatcher.
  - Runs all scheduled skills and aggregates failure handling.
  - Contains no Discord request/response schema knowledge.

- scheduled skill modules (for example `src/wordOfDaySchedule.ts`)
  - Skill-specific scheduled behavior.
  - Validate and execute scheduled skill logic.
  - Keep transport details out of `app`.

- `core` (`src/core.ts`)
  - Shared request/result interfaces for app, dispatch, and command.
  - No external runtime dependencies.

---

## Dependency directions

Allowed dependencies:

- `app -> dispatch`
- `app -> command`
- `app -> scheduled`
- `app -> core`
- `dispatch -> core`
- `command -> core`
- `scheduled -> (scheduled skill modules)`

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
6. Command skill handler returns a `core` result.
7. `app` maps the result back to Discord response payloads and side effects.

Scheduled skill flow:

1. `app` receives a scheduled event.
2. `app` delegates to `scheduled`.
3. `scheduled` executes all scheduled skills.
4. Each scheduled skill decides whether it should activate for that event.

---

## Ownership boundaries

Dependency direction is necessary but not sufficient. Ownership boundaries define
where behavior should live even when import edges are technically valid.

- `app` owns transport concerns only:
  - Discord HTTP auth/signature verification.
  - Wire-format validation and conversion to flat app requests.
  - Mapping dispatch outcomes to Discord response payloads.
  - Generic queue transport wiring (enqueue/dequeue, ack, Discord PATCH).
  - Generic scheduled transport wiring (invoke scheduled dispatcher, log errors).

- Command skill modules own command-specific behavior:
  - Command-skill-specific modal interpretation (custom IDs and input extraction).
  - Command-skill-specific follow-up task payload shape.
  - Command-skill-specific provider integration details (prompting, AI result parsing,
    fallback messages, logging fields).

- Scheduled skill modules own scheduled-skill-specific behavior:
  - Activation checks (for example schedule-time gating).
  - Scheduled-skill payload and provider integration details.
  - Scheduled-skill-specific fallback messages and logging fields.

- `dispatch` and `core` own routing/contracts, not command implementation
  details.

- `core` contracts must remain command-skill-agnostic:
  - No command names (for example, `'pastify'`) in `core` type literals.
  - No command-specific type names in `core` (for example, `Pastify*`).
  - Use generic envelopes in `core`; command skill modules validate command-specific
    payload shape locally.

Practical rule: if code references a specific skill's IDs, prompt text,
model behavior, or task payload fields, it belongs in skill-owned code,
not `app`.

---

## Scope notes

- This layering is intentionally lightweight: no plugin system, no service
  registry, no boundary-enforcement tooling yet.
- If import-boundary violations become a repeated issue, add mechanical
  enforcement (lint/import graph rules) in a separate change.
