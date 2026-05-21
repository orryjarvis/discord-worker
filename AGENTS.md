# AGENTS.md

This file is a map, not a manual. Read it to orient yourself, then go to the code.

For deeper operating principles, see [docs/design-docs/index.md](docs/design-docs/index.md).

---

## Project snapshot

A Cloudflare Worker that receives Discord slash command interactions, verifies
the request signature, and handles commands.

Current commands:
- `/pastify` — Opens a modal immediately, accepts a free-form idea, defers
  publicly on submit, then generates a channel-visible Twitch-style copypasta
  through Workers AI.

Runtime: Cloudflare Workers (no Node.js APIs at runtime).  
Language: TypeScript.  
Deployment: Wrangler (`wrangler.jsonc`).  
Required env bindings: `DISCORD_APPLICATION_ID`, `SIGNATURE_PUBLIC_KEY`,
`DISCORD_TOKEN`, `FOLLOW_UP_QUEUE`, `AI`.

## Agent bootstrap

- `.vscode/mcp.json` is the repo's source of truth for MCP servers.
- `skills-lock.json` pins the Cloudflare skills bundle installed under the gitignored `.agents/skills/` directory.
- If `.agents/skills/` is missing, reinstall it from the repo root with `npx skills experimental_install`; if skills are suspected to be stale then run `npx skills update -p` then keep the lock file in sync.

---

## Where to look

| What | Where |
|---|---|
| Worker entry point | `src/index.ts` |
| App adapter (Discord <-> app transforms) | `src/app.ts` |
| Command definitions | `src/command.ts` |
| Dispatch router | `src/dispatch.ts` |
| Core request/result interfaces | `src/core.ts` |
| Discord helpers (verify, respond) | `src/discord.ts` |
| Unit tests | `test/worker.test.ts` |
| E2E / smoke tests | `test/e2e/` |
| E2E test config | `test/e2e/vitest.e2e.config.ts` |
| Smoke test config | `test/e2e/vitest.smoke.config.ts` |
| Shared e2e setup | `test/e2e/setup.shared.ts` |
| Deploy scripts | `scripts/` |
| Build / lint / test commands | `package.json` |
| Cloudflare config | `wrangler.jsonc` |
| TypeScript config | `tsconfig.json` |
| Design docs | `docs/design-docs/` |
| Copilot agent bootstrap | `.github/copilot-instructions.md` |

---

## Working rules

- **Inspect before changing.** Read `package.json`, `tsconfig.json`, and
  `wrangler.jsonc` before touching build, lint, or deploy config.
- **Prefer minimal, shippable changes.** Do not add indirection until there is
  a concrete reason.
- **No abstractions without evidence.** A new helper, service, or layer needs
  at least two real call sites or a clear near-term second use case. One
  call site does not justify abstraction.
- **Do not break the test harness.** The e2e and smoke test setup under
  `test/e2e/` is part of the product. Do not delete or restructure it
  without understanding what it does.
- **Run validation before considering work done.** See _Testing and
  validation_ below.

---

## Architecture boundaries

The codebase is intentionally small but now uses a documented layering split:

- `src/app.ts` is the Discord-facing app adapter. It validates/signature-checks
  requests, transforms Discord payloads to flat app requests, calls dispatch,
  and maps dispatch results back to Discord responses.
- `src/dispatch.ts` is the routing core. It chooses a command handler by name
  and does not import Discord-specific code.
- `src/command.ts` defines command behavior and command constants. It works in
  terms of core request/result interfaces and does not import dispatch.
- `src/core.ts` defines shared interfaces used by app, dispatch, and command.

Dependency direction (allowed edges):

- `app -> dispatch`
- `app -> command`
- `app -> core`
- `dispatch -> core`
- `command -> core`

Disallowed edges:

- `dispatch -> command`
- `command -> dispatch`
- Any lower layer importing from `app`

`src/index.ts` should remain a thin entrypoint that re-exports `src/app.ts`.

See [docs/design-docs/core-beliefs.md](docs/design-docs/core-beliefs.md) for
the reasoning behind this.

---

## Testing and validation

Before marking work done, run:

```sh
npm run check   # TypeScript type check
npm run lint    # ESLint
npm run test    # Unit tests (Vitest)
npm run e2e     # E2E tests (requires wrangler dev environment)

# Optional (live shared test env): smoke tests. Run only after
# `npm run publish:test` has completed and team coordination confirms the
# shared environment is ready. `npm run smoke` auto-loads `.env.smoke.local`
# when present.
# Agent policy: do not run `npm run smoke` directly; instead suggest it to the
# user when live-environment validation is appropriate.
npm run smoke
```

Unit tests should cover the current follow-up flow by asserting that the worker
enqueues work with `FOLLOW_UP_QUEUE.send`. Do not rely on the removed
`waitUntil`/fake-timer path when updating or adding tests.

E2E tests use Wrangler's `unstable_dev` with `env: 'dev'` and `local: true`. Queue bindings require local mode — remote mode (`local: false`) does not support queues and causes 503s on all requests.

Do not delete or rewrite test helpers without understanding what they test.

---

## Documentation rules

- Update docs only when behavior, structure, or operating assumptions change.
- Do not add speculative docs for features that do not exist yet.
- If you find a doc that no longer reflects reality, delete or correct it —
  do not leave it as a misleading artifact.
- Design docs live in `docs/design-docs/`. Add a new one only when it
  captures a stable decision, resolves repeated agent confusion, or documents
  a real boundary.

---

## Non-goals (right now)

- A command framework or plugin registry.
- Generated documentation or table-of-contents machinery.
- Strict import-boundary enforcement tooling (ESLint/import graph rules).
- Execution-plan systems or quality scorecards.
- Doc-gardening automation.
- A broad `docs/` hierarchy beyond `docs/design-docs/`.

These may be appropriate later. They are not appropriate now.
