# Container Rewrite Branch Context

This branch proves a gradual rewrite path where the Cloudflare Worker becomes a
thin JavaScript shim in front of a Cloudflare-hosted container.

## Current Iteration

- Keep the existing bot code in the repository for reference, but route Wrangler
  to `src/rewrite/index.js`.
- Keep the Worker shim minimal: one health endpoint and otherwise pass requests
  to a single Cloudflare Container instance.
- Use a small hello-world HTTP container for now. The target runtime is Zig, but
  the first useful proof is the Worker-to-container boundary, not the final
  container implementation language.

## Rewrite Direction

- Prefer forwarding platform APIs through Cloudflare's supported container
  facilities before inventing custom stubs.
- Only add explicit container-to-Worker API shims when the container actually
  needs access to a Worker binding or runtime feature.
- Keep the shim contract HTTP-shaped unless there is a concrete reason for a
  richer RPC layer.
- Avoid migrating the existing Discord bot behavior wholesale until the
  container boundary and deployment loop are proven.

## First Useful Checks

- `GET /healthz` should respond from the Worker.
- Any other route should be proxied to the container and return the hello-world
  container response.
