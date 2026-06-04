# Architecture layering

This document records the current intentional layering used by the Worker.

The goal is to keep skill logic independent from Discord payload shape,
make integration boundaries explicit and enforceable, and keep the
codebase small and direct.

---

## Layers

Six layers, from lowest to highest:

- **`core`** (`src/core/`)
  - Shared request/result interfaces used across the codebase.
  - No external runtime or platform dependencies.
  - No Discord, GitHub, or Cloudflare-specific terms.

- **`integrations`** (`src/integrations/`)
  - Outbound API clients and external data parsers.
  - Wraps HTTP calls to Discord, GitHub, and third-party feeds.
  - No app-specific business logic — pure transport.

- **`skills`** (`src/skills/`)
  - App-bespoke logic that uses integrations.
  - Content formatting, AI prompt orchestration, GitHub issue creation.
  - No knowledge of Discord interaction payloads or command routing.

- **`commands`** (`src/commands/`)
  - Command handlers and follow-up execution logic.
  - Interprets app request types from `core` and returns `core` result types.
  - Composes skills to produce Discord-presentable content.

- **`handlers`** (`src/handlers/`)
  - Inbound request handlers for each platform surface.
  - `discord.ts`: verifies signatures, parses interactions, dispatches to commands.
  - `github.ts`: verifies HMAC, deduplicates events, dispatches to commands.
  - `cloudflare.ts`: queue batch processing and scheduled event dispatch.

- **`app`** (`src/app.ts`)
  - Worker entry point wiring only.
  - Routes `fetch`, `queue`, and `scheduled` to the appropriate handler.
  - No skill logic, no integration calls, no command routing.

---

## Dependency directions

Allowed edges (lower layers may not import from higher layers):

```
core  ←  integrations  ←  skills  ←  commands  ←  handlers  ←  app
```

Explicitly:

- `integrations` → `core` only
- `skills` → `core`, `integrations`
- `commands` → `core`, `skills`
- `handlers` → `core`, `commands`
- `app` → `handlers`, `core`

---

## Enforcement

ESLint `no-restricted-syntax` rules in `eslint.config.mjs` enforce the allowed
import edges for each layer. Violations are lint errors. The rules use esquery
attribute selectors with `:not()` to whitelist allowed parent-directory imports
and ban everything else.

`src/core/**` also bans string literals containing `discord`, `github`, or
`cloudflare` to prevent platform-specific terms from leaking into core contracts.

---

## Notable design choices

- `AiRuntimeEnv` lives in `src/skills/ai.ts`, not `core`, because it
  references the Cloudflare `Ai` binding type which is platform-specific.
- `jsonResponse` is inlined in `src/handlers/discord.ts` (3 lines) rather
  than imported from integrations, so handlers remain clean of integration
  dependencies.
- Follow-up delivery (Discord PATCH after queue processing) lives in
  `src/skills/discordInteraction.ts`. Commands compose it via
  `executeAndDeliverFollowUp` in `src/commands/index.ts`, keeping the
  handler free of direct integration access.

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
