---
applyTo: ".github/workflows/**/*.yml,package.json,scripts/**/*.ts,docs/references/local-dev.md"
---

# CI/CD Skill

Use this instruction set when modifying validation pipelines, build scripts, or release checks.

## Primary References

- [AGENTS.md](../../AGENTS.md)
- [QUALITY.md](../../QUALITY.md)
- [docs/references/local-dev.md](../../docs/references/local-dev.md)
- [docs/references/error-messages.md](../../docs/references/error-messages.md)

## Pipeline Expectations

- CI must gate on type check, lint, unit tests, and e2e tests.
- Failures should be actionable and easy to map to file-level fixes.
- Local workflow should mirror CI as closely as possible.

## Required Workflow

1. Update workflow or scripts with minimal, explicit changes.
2. Keep command order consistent with local validation:
   - `npm run check`
   - `npm run lint`
   - `npm test`
   - `npm run e2e`
3. Update docs when command names or expectations change.
4. Validate in local environment before proposing CI-only changes.

## Authoring Rules

- Prefer readable job names and step names.
- Avoid hidden logic in one-liners when scripts can clarify intent.
- Keep timeout and retry behavior explicit.
- Ensure output remains parseable for humans and agents.

## Definition of Done

- CI and local dev flow stay aligned.
- Pipeline changes are documented.
- Build/test/lint gates still block regressions.
- No unexpected workflow drift introduced.
