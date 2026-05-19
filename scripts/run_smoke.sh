#!/usr/bin/env bash
set -euo pipefail

# Load local smoke env vars if present. CI can still inject env vars directly.
if [[ -f .env.smoke.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.smoke.local
  set +a
fi

if [[ -z "${LIVE_BASE_URL:-}" ]]; then
  echo "LIVE_BASE_URL must be set (export it or define it in .env.smoke.local)" >&2
  exit 1
fi

if [[ -z "${SIGNATURE_PRIVATE_KEY:-}" ]]; then
  echo "SIGNATURE_PRIVATE_KEY must be set (export it or define it in .env.smoke.local)" >&2
  exit 1
fi

npx vitest --config ./test/e2e/vitest.smoke.config.ts
