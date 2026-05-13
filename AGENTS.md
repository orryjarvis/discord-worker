# Agents & Tooling Guide

This document is the **universal entry point** for all agent-accessible context in discord-worker. Agents and humans should start here to understand how the project is structured and how to contribute effectively.

---

## 🗺️ Quick Navigation

### Project Knowledge

- [**ARCHITECTURE.md**](./ARCHITECTURE.md) — System design, module dependencies, and data flow
- [**docs/design-docs/**](./docs/design-docs/) — Detailed design decisions and rationale
- [**docs/references/**](./docs/references/) — Quick references, patterns, and examples
- [**docs/exec-plans/**](./docs/exec-plans/) — Execution plans, tech debt, and active work

### Running & Validating Locally

- [docs/references/local-dev.md](./docs/references/local-dev.md) — How to build, test, lint, and interpret output
- [docs/references/error-messages.md](./docs/references/error-messages.md) — What test/lint failures mean and how to fix them

### Contribution Workflows

When working on discord-worker, use the relevant workflow guide:

| Task | See |
|------|-----|
| Add a new command | [docs/design-docs/commands.md](./docs/design-docs/commands.md) |
| Add a new service | [docs/design-docs/services.md](./docs/design-docs/services.md) |
| Fix a bug or refactor | [docs/design-docs/testing.md](./docs/design-docs/testing.md) |
| Review project health | [QUALITY.md](./QUALITY.md) |

### Enforcement & Rules

- [docs/design-docs/architecture-rules.md](./docs/design-docs/architecture-rules.md) — Linting rules, file naming, import constraints
- [.github/copilot-instructions.md](./.github/copilot-instructions.md) — VS Code-specific agent guidance

---

## 📋 Project Quick Facts

- **Language:** TypeScript
- **Runtime:** Node.js + Cloudflare Workers
- **Test Framework:** Vitest (unit, integration, e2e)
- **Bot Platform:** Discord API
- **Main Entrypoint:** [src/index.ts](./src/index.ts)
- **Commands Location:** [src/commands/](./src/commands/)
- **Services Location:** [src/services/](./src/services/)

---

## 🚀 Getting Started (Agents)

### Before You Code

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand data flow and module dependencies
2. Identify which area you're working in (commands, services, infra, tests)
3. Find the relevant design doc in [docs/design-docs/](./docs/design-docs/)
4. Review [docs/references/local-dev.md](./docs/references/local-dev.md) — you'll validate locally

### While You Code

- Follow patterns in [docs/design-docs/architecture-rules.md](./docs/design-docs/architecture-rules.md)
- Use [docs/references/](./docs/references/) for code snippets and patterns
- Run `npm run check`, `npm run lint`, `npm test` frequently (see [docs/references/local-dev.md](./docs/references/local-dev.md) for interpretation)

### Before You Push

- All tests pass: `npm run build` (runs all checks, linting, unit tests, e2e tests)
- Lint passes: `npm run lint`
- Coverage is acceptable: `npm test -- --coverage` (see [QUALITY.md](./QUALITY.md) for thresholds)
- Docs are updated if you changed public APIs or added features

---

## 📚 Document Index

### Design Documentation (docs/design-docs/)

- `architecture-rules.md` — Import constraints, file naming, module boundaries
- `commands.md` — How to add and test a new command
- `services.md` — How to add and integrate a new service
- `testing.md` — Testing strategy, coverage expectations, patterns
- `error-handling.md` — How errors are caught, logged, and handled

### Reference Documentation (docs/references/)

- `local-dev.md` — Running `npm test`, `npm run lint`, `npm run check` locally
- `error-messages.md` — Catalog of common test/lint failures and fixes
- `code-patterns.md` — Common TypeScript patterns, dependency injection, async patterns
- `glossary.md` — Terminology used in the project

### Project Planning (docs/exec-plans/)

- `active/` — Current work, including this harness-engineering initiative
- `completed/` — Finished initiatives and lessons learned
- `tech-debt.md` — Backlog of tech debt items and priorities

---

## 🔄 Feedback Loop (The Ralph Wiggum Loop)

Agents validate changes locally and self-correct before requesting review:

1. **Code** → 2. **Run `npm run build`** → 3. **Interpret failures** (see error-messages.md) → 4. **Fix** → 5. **Repeat until passing** → 6. **Push**

This feedback loop only works if error messages are legible (plain English, actionable, cite docs). See [docs/references/error-messages.md](./docs/references/error-messages.md) and [docs/references/local-dev.md](./docs/references/local-dev.md).

---

## 🛠️ For Maintainers

Update this document whenever:

- You add a new design doc
- You add a new section to ARCHITECTURE.md or QUALITY.md
- You add or change a major enforcement rule
- Project structure changes

This is the **single source of truth** for how agents discover project context.
