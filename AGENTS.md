# AGENTS.md

This file is a map, not a manual. Read it to orient yourself, then go to the code.

For deeper operating principles, see [docs/design-docs/index.md](docs/design-docs/index.md).

---

## Project snapshot

A Cloudflare Worker that receives Discord slash command interactions, verifies
the request signature, runs bot skills, and receives GitHub webhook delivery
events for deployment-status channel notifications.

Current skills:
- Command skill: `/pastify` — Opens a modal immediately, accepts a free-form idea, defers
  publicly on submit, then generates a channel-visible Twitch-style copypasta
  through Workers AI.
- Command skill: `/insult` — Slash command taking a target user option and generating a
  channel-visible light-hearted roast via Workers AI.
- Command skill: `insult` (User context command) — Right-click a user and trigger an
  ephemeral defer followed by a roast targeting that selected user.
- Scheduled skill: `word-of-day` — Daily Word of the Day post flow (Merriam-Webster RSS) via the scheduled entrypoint.

Runtime: Cloudflare Workers (no Node.js APIs at runtime).  
Language: TypeScript.  
Dev/build: Vite + Cloudflare Vite plugin (`vite.config.ts`) with Wrangler config input (`wrangler.jsonc`).  
Required env bindings: `DISCORD_APPLICATION_ID`, `SIGNATURE_PUBLIC_KEY`,
`DISCORD_TOKEN`, `FOLLOW_UP_QUEUE`, `AI`, `GITHUB_WEBHOOK_SECRET`.
Scheduled skill bindings: `WORD_OF_DAY_CHANNEL_ID` (required for scheduled posting),
`WORD_OF_DAY_FEED_URL` (optional override).
GitHub webhook config: `GITHUB_DEPLOY_WORKFLOW_PATH` (workflow file filter for
`/github` webhook events).

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
| GitHub webhook handling | `src/githubWebhook.ts` |
| Command skills definitions | `src/command.ts` |
| Scheduled skill dispatcher | `src/scheduled.ts` |
| Word-of-day scheduled skill | `src/wordOfDaySchedule.ts` |
| Dispatch router | `src/dispatch.ts` |
| Core request/result interfaces | `src/core.ts` |
| Discord helpers (verify, respond) | `src/discord.ts` |
| Unit tests | `test/worker.test.ts` |
| E2E tests | `e2e/interactions.test.ts` |
| E2E test config | `e2e/vitest.config.ts` |
| E2E setup files | `e2e/setup.ts`, `e2e/globalSetup.ts` |
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
- **Do not break the test harness.** The e2e setup under
  `e2e/` is part of the product. Do not delete or restructure it
  without understanding what it does.
- **Run validation before considering work done.** See _Testing and
  validation_ below.

---

## Architecture boundaries

The codebase is intentionally small but now uses a documented layering split:

- `src/app.ts` is the Discord-facing app adapter. It validates/signature-checks
  requests, transforms Discord payloads to flat app requests, calls dispatch,
  and maps dispatch results back to Discord responses.
- `src/app.ts` owns transport/orchestration only. Do not place
  skill-specific modal parsing, AI prompt/output parsing, or skill-specific
  follow-up payload semantics in this layer.
- `src/dispatch.ts` is the routing core for command skills. It chooses a command handler by name
  and does not import Discord-specific code.
- `src/command.ts` defines command-skill behavior and command constants. It works in
  terms of core request/result interfaces and does not import dispatch.
- `src/scheduled.ts` is the routing core for scheduled skills. It runs scheduled
  activities and should remain generic.
- `src/wordOfDaySchedule.ts` defines the word-of-day scheduled skill behavior.
- `src/core.ts` defines shared interfaces used by app, dispatch, and command.
  Keep `core` command-skill-agnostic: no command-specific type names or string
  literals in core contracts.

Dependency direction (allowed edges):

- `app -> dispatch`
- `app -> command`
- `app -> scheduled`
- `app -> core`
- `dispatch -> core`
- `command -> core`
- `scheduled -> wordOfDaySchedule`

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
npm run build   # Vite
npm run test    # Unit tests (Vitest)
npm run e2e     # E2E tests (requires wrangler dev environment)
```

Unit tests should cover the current follow-up flow by asserting that the worker
enqueues work with `FOLLOW_UP_QUEUE.send`. Do not rely on the removed
`waitUntil`/fake-timer path when updating or adding tests.

E2E tests run under the `@cloudflare/vitest-pool-workers` Vitest plugin (`e2e/vitest.config.ts`). The worker is invoked directly via `SELF.fetch()` inside the Workers runtime — no `unstable_dev` or separate server process. A Node mock server started in `e2e/globalSetup.ts` intercepts outbound Discord API and RSS calls.

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
