# AGENTS.md

This file is a map, not a manual. Read it to orient yourself, then go to the code.

For deeper operating principles, see [docs/design-docs/index.md](docs/design-docs/index.md).

---

## Project snapshot

A Cloudflare Worker that receives Discord slash command interactions, verifies
the request signature, and handles commands.

Current commands:
- `/test` — Defers the interaction immediately (type 5 response), waits 5
  seconds, then edits the original response to `Hello World`.

Runtime: Cloudflare Workers (no Node.js APIs at runtime).  
Language: TypeScript.  
Deployment: Wrangler (`wrangler.jsonc`).  
Required env bindings: `DISCORD_APPLICATION_ID`, `SIGNATURE_PUBLIC_KEY`,
`DISCORD_TOKEN`.

---

## Where to look

| What | Where |
|---|---|
| Worker entry point | `src/index.ts` |
| Discord helpers (verify, respond, sleep) | `src/discord.ts` |
| Unit tests | `test/basic.test.ts` |
| E2E / smoke tests | `test/e2e/` |
| E2E test config | `test/e2e/vitest.e2e.config.ts` |
| Smoke test config | `test/e2e/vitest.smoke.config.ts` |
| Shared e2e setup | `test/e2e/setup.shared.ts` |
| Deploy scripts | `scripts/` |
| Build / lint / test commands | `package.json` |
| Cloudflare config | `wrangler.jsonc` |
| TypeScript config | `tsconfig.json` |
| Design docs | `docs/design-docs/` |

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

The codebase is intentionally small. There is currently no layered architecture.

The Worker is direct and shippable: `src/index.ts` handles the HTTP request,
verifies the signature, dispatches to a command function, and returns.
`src/discord.ts` holds Discord-specific helpers. That is the full current
structure.

The long-term goal is an intentional dependency DAG — dependencies point in
explicit, documented directions with limited allowed edges. However:

- **Do not create a layer before there is a concrete boundary to protect.**
- If a real boundary emerges (a second command, a service integration, a
  separate deployment target), document the allowed dependency direction
  first, then add the folder or abstraction.
- Any future architecture doc should describe allowed dependency directions
  before adding enforcement.

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
```

Unit tests use fake timers and a stubbed `fetch` to exercise the deferred
`waitUntil` task without a real network or clock.

E2E tests use Wrangler's `unstable_dev` with `env: 'dev'` and `local: false`.
Smoke tests hit a live URL via `LIVE_BASE_URL` and use the shared request
signer in `test/e2e/signAndSendRequest.ts`.

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
- A layered architecture with enforced import rules.
- Execution-plan systems or quality scorecards.
- Doc-gardening automation.
- A broad `docs/` hierarchy beyond `docs/design-docs/`.

These may be appropriate later. They are not appropriate now.
