# Test tiers and CI gates

Captures the three-tier test model, the shared-test-file pattern, and the PR
vs. main gate structure. Primary audience: future agents working in this repo.

---

## Three test tiers

There are three test tiers, each requiring more infrastructure than the last.
Run the cheapest tier that gives you enough confidence for the current context.

### Unit tests — `npm test`

- **What:** Logic-level tests with all external calls mocked.
- **Infrastructure:** None. No Wrangler, no worker process, no live deployment.
- **Speed:** Fast (subsecond startup, no network).
- **Source:** `test/worker.test.ts`
- **When to run:** Always. Cheapest gate; catches regressions in isolation.

### E2E tests — `npm run e2e`

- **What:** Full request/response/queue cycle against a locally-spawned worker.
- **Infrastructure:** `wrangler unstable_dev` in `local: true` mode. Spins up a
  real worker process on a free port. No live deployment or external network
  needed.
- **Speed:** Medium (~15 s test timeout; worker startup adds a few seconds).
- **Source:** `test/e2e/interactions.test.ts` via `test/e2e/setup.e2e.ts`
- **When to run:** Before merging. Verifies the full interaction flow including
  the queue consumer without touching live infrastructure.
- **Constraint:** Wrangler's local dev mode is required. Remote mode
  (`local: false`) does not support queue bindings and causes 503s on all
  requests.
- **Scheduled skills in this tier:** Triggered via test double endpoint
  `GET /__test/scheduled` (not by waiting on cron).

### Smoke tests — `npm run smoke`

- **What:** The same interaction test suite run against a live deployed worker.
- **Infrastructure:** A deployed Cloudflare Worker at `LIVE_BASE_URL`. Requires
  `SIGNATURE_PRIVATE_KEY` to sign requests. The worker must have `TEST_FOLLOWUPS`
  KV bound and `DISCORD_API_BASE_URL` pointing to itself so the test sink routes
  (`/__test/*`) work correctly.
- **Local secrets workflow:** `npm run smoke` loads `.env.smoke.local` when
  present (via `scripts/run_smoke.sh`). Keep secrets there; do not commit it.
  Use `.env.smoke.example` as a template.
- **Speed:** Slow (~60–70 s; includes follow-up polling against real queues).
- **Source:** `test/e2e/interactions.test.ts` via `test/e2e/setup.smoke.ts`
- **When to run:** After deploying to the test environment, before releasing to
  production. Not run on PRs (see _Rejected alternative_ below).
- **Scheduled skills in this tier:** Triggered via the same test double endpoint
  `GET /__test/scheduled`, so smoke validation does not depend on cron timing.

---

## Same-test-file, different-setup pattern

`test/e2e/interactions.test.ts` is the single source of truth for interaction
tests. It imports from `./signAndSendRequest`, which is a dispatcher module that
re-exports from either `setup.e2e.ts` or `setup.smoke.ts` depending on the
`TEST_SETUP` env var set by the respective Vitest config.

Both setup modules expose the same interface:

```ts
signAndSendRequest(body: object): Promise<Response>
waitForFollowUp(correlationId: string, timeoutMs?: number): Promise<any>
waitForChannelPost(channelId: string, timeoutMs?: number): Promise<any>
runScheduled(cron: string, time: number): Promise<Response>
```

This means:

- Tests are written once and verified at both tiers automatically.
- A test that passes e2e but fails smoke indicates an environment configuration
  problem, not a logic bug.
- New tests should be added to `interactions.test.ts` and will run at both
  tiers without any additional wiring.

The test sink routes used by this pattern now include:

- `GET /__test/scheduled` — test double trigger for scheduled skills.
- `GET /__test/channel-posts/:channelId` — polls scheduled skill post output.

---

## CI gate structure

### PR workflow (`.github/workflows/pr.yaml`)

All jobs run in parallel on every pull request. There are no dependencies
between them. All must pass before a PR can merge.

| Job | Command |
|---|---|
| `test` | `npm test` |
| `lint` | `npm run lint` |
| `audit` | `npm audit --omit=dev` |
| `build` | `npm run check` |
| `e2e` | `npm run e2e` |

### Main workflow (`.github/workflows/ci.yaml`)

Runs on every push to `main`. Jobs are strictly sequential; each depends on
the previous succeeding.

```
release-test → smoke-test → release → post-release
```

| Job | What it does |
|---|---|
| `release-test` | Deploys to the `test` Cloudflare environment |
| `smoke-test` | Runs `npm run smoke` against the test deployment |
| `release` | Deploys to the `prod` Cloudflare environment |
| `post-release` | Registers slash commands with Discord via `deploy_commands` |

**Smoke gates prod.** Nothing ships to production unless the smoke suite passes
against the test environment first.

---

## Rejected alternative: smoke tests on PRs

Running smoke tests on every PR was considered and rejected. The reasons:

- It would require deploying a live worker per PR, adding cost and complexity.
- It would require environment isolation across concurrent PRs.
- E2E on local wrangler already provides full-fidelity coverage of the
  interaction flow, including the queue consumer, without live infrastructure.
- Smoke is a deployment-gate check — its job is to confirm the deployed
  artifact works on real Cloudflare infrastructure, not to catch logic bugs.
  That job belongs to e2e.

The boundary is: e2e is the per-PR proxy for production readiness; smoke is the
pre-prod gate after a real deployment.
