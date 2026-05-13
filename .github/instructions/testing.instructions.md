---
applyTo: "test/**/*.ts,vitest.config.ts,src/**/*.ts"
---

# Testing Skill

Use this instruction set when writing or modifying tests.

## Primary References

- [AGENTS.md](../../AGENTS.md)
- [docs/design-docs/testing.md](../../docs/design-docs/testing.md)
- [docs/references/local-dev.md](../../docs/references/local-dev.md)
- [docs/references/error-messages.md](../../docs/references/error-messages.md)

## Required Workflow

1. Add tests for behavior changes before or alongside implementation.
2. Cover success, edge, and error paths.
3. Mock network and external dependencies.
4. Run targeted tests first, then full suite.

## Coverage Expectations

- Commands: 85%
- Services: 80%
- Core flow: 90%
- Overall baseline: 75%

## Test Patterns

- Use clear `describe` and `it` names.
- Assert behavior over implementation details.
- Keep each test independent.
- Prefer deterministic mocks over timers and sleeps.

## Validation Commands

```bash
npm run check
npm run lint
npm test
npm run e2e
npm test -- --coverage
```

## Definition of Done

- New/changed behavior has automated test coverage.
- No flaky or timing-sensitive tests introduced.
- Coverage does not regress unexpectedly.
- Full local validation passes.
