# Test tiers and CI gates

Captures the current two-tier test model, local e2e harness shape, and PR vs.
main CI gate structure. Primary audience: future agents working in this repo.

---

## Two test tiers

Run the cheapest tier that gives enough confidence for the current context.

### Unit tests — `npm test`

- **What:** Logic-level tests with all external calls mocked.
- **Infrastructure:** None. No Wrangler, no worker process, no live deployment.
- **Speed:** Fast (subsecond startup, no network).
- **Source:** `test/worker.test.ts`, plus focused unit suites under `test/`.
- **When to run:** Always. Cheapest gate; catches regressions in isolation.

### E2E tests — `npm run e2e`

- **What:** Full request/response/queue cycle against a locally-spawned worker.
- **Infrastructure:** `wrangler unstable_dev` in `local: true` mode plus a
  local Discord API capture server started by `test/e2e/setup.e2e.ts`.
- **Speed:** Medium (~15 s test timeout; worker startup adds a few seconds).
- **Source:** `test/e2e/interactions.test.ts` via `test/e2e/setup.e2e.ts`.
- **When to run:** Before merging. Verifies end-to-end interaction behavior
  without relying on worker test-only routes.
- **Constraint:** Wrangler local mode is required. Remote mode (`local: false`)
  does not support queue bindings and causes 503s on all requests.
- **Scheduled skills in this tier:** Triggered via the worker scheduled handler
  from the e2e harness, not via HTTP endpoints.

---

## E2E harness contract

The e2e suite uses a single setup module: `test/e2e/setup.e2e.ts`.

It exports this interface:

```ts
signAndSendRequest(body: object): Promise<Response>
waitForFollowUp(correlationId: string, timeoutMs?: number): Promise<any>
waitForChannelPost(channelId: string, timeoutMs?: number): Promise<any>
clearChannelPost(channelId: string): Promise<void>
runScheduled(cron: string, time: number): Promise<Response>
```

Harness details:

- Outbound Discord webhook edits and channel posts are captured by a local HTTP
  server bound to `DISCORD_API_BASE_URL` during e2e startup.
- Tests poll in-memory captured requests keyed by correlation id or channel id.
- Scheduled validation calls the scheduled entrypoint through Wrangler runtime
  APIs rather than exposing test-only worker routes.

---

## CI gate structure

### PR workflow (`.github/workflows/pr.yaml`)

All jobs run in parallel on every pull request. All must pass before merge.

| Job | Command |
|---|---|
| `test` | `npm test` |
| `lint` | `npm run lint` |
| `audit` | `npm audit --omit=dev` |
| `build` | `npm run check` |
| `e2e` | `npm run e2e` |

### Main workflow (`.github/workflows/ci.yaml`)

Runs on every push to `main`. Jobs are sequential.

```
release-test → post-release-test → release → post-release
```

| Job | What it does |
|---|---|
| `release-test` | Deploys to the `test` Cloudflare environment |
| `post-release-test` | Registers slash commands in the test Discord guild |
| `release` | Deploys to the `prod` Cloudflare environment |
| `post-release` | Registers slash commands in the production Discord guild |
