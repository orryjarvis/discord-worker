# Discord Worker

This repository is a bootstrap for a runtime-agnostic, command-oriented bot framework.

## Layering

- `src/core` contains the transport-neutral pipeline, envelope, routing, session, rendering, and responder contracts.
- `src/commands` contains portable command definitions and their command-owned dependency contracts.
- `src/integrations` contains concrete adapters for external APIs or SDKs.
- `src/frontends` contains platform adapters that normalize raw events and own response serialization.
- `src/runtimes` contains host-specific runtime plumbing such as process execution and Workers storage.
- `src/apps` contains composition roots that wire concrete frontends, runtimes, commands, and integrations together.

## Normalized flow

1. Receive a raw event.
2. Normalize it into a `CommandEnvelope`.
3. Admit or reject the request.
4. Optionally acknowledge or defer.
5. Route to a command.
6. Load or create a session.
7. Execute the handler.
8. Render the result to a transport payload.
9. Send the response or follow-up.

## Current bootstrap

- CLI app: `src/apps/cli-local/main.ts`
- Discord worker app: `src/apps/discord-worker/worker.ts`
- Reddit integration: `src/integrations/reddit/redditApiAdapter.ts`
- Reddit command: `src/commands/reddit/trending.ts`

## Examples

CLI:

```bash
npm run start:cli -- reddit trending javascript
```

Discord:

- Configure a slash command that maps to `reddit trending` with a `subreddit` option.
- Deploy the Worker entrypoint from `src/index.ts`.

## Notes

- The Discord frontend currently normalizes verified interactions and supports deferred acknowledgments plus webhook follow-ups.
- The Reddit integration uses the public Reddit JSON API and does not require a platform SDK.

## E2E And Smoke Testing

App-scoped suites:

- `npm run e2e:discord-worker` runs signed Discord-style requests against an in-process dev worker started by Wrangler `unstable_dev`.
- `npm run smoke:discord-worker` runs the same Discord-worker suite against `LIVE_BASE_URL` (defaults to `http://127.0.0.1:8787` when unset).
- `npm run e2e:cli-local` runs end-to-end tests for the `cli-local` composition root.
- `npm run e2e` is an alias for `e2e:discord-worker`.
- `npm run e2e:all` runs both app suites.

Environment variables:

- `LIVE_BASE_URL` (optional for smoke; defaults to local dev URL)
- `SIGNATURE_PRIVATE_KEY` (optional for `e2e:discord-worker`; typically required for deployed smoke unless fallback key matches target public key)

Key behavior:

- The shared Discord-worker signer uses a fallback private key that matches the dev public key in `wrangler.toml`.
- Smoke tests in CI provide `SIGNATURE_PRIVATE_KEY` through GitHub secrets so signatures match the deployed test environment key.
