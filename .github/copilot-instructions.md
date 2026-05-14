# GitHub Copilot — Bootstrap Instructions

Read these two files before doing anything else:

- [`AGENTS.md`](/AGENTS.md) — project map, working rules, architecture
  boundaries, test harness details, and validation commands
- [`docs/design-docs/index.md`](/docs/design-docs/index.md) — design doc
  system of record and operating principles

---

## Core principles

- **Agent-first harness.** The test and deployment harness is a first-class
  product artifact, not scaffolding. Do not restructure it casually.
- **Architecture from real pressure.** Do not introduce layers, abstractions,
  or helpers unless a concrete second use case exists today.
- **Small, shippable changes.** Prefer the minimal change that solves the
  problem over the change that anticipates future problems.
- **Preserve the test harness.** `test/e2e/` setup and configs are
  load-bearing. Understand what they do before touching them.

## What not to do

- Do not add command frameworks, plugin registries, or service layers
  speculatively.
- Do not create abstractions with a single call site.
- Do not duplicate content from `AGENTS.md` here.

## Validation

Before marking work done:

```sh
npm run check && npm run lint && npm run test && npm run e2e
```
