# Tech Debt & Backlog

This document is the source of truth for technical debt, missing features, and quality improvements. Items here are priorities for future execution plans or ad-hoc agent work.

Use the [tech-debt-item.prompt.md](../prompts/tech-debt-item.prompt.md) to work on any of these items.

---

## Backlog Items

### Process & Infrastructure

Add infrastructure and process improvements here. Examples:
- Dev container & Codespaces setup
- CI/CD pipeline enhancements
- Local development tooling

### Feature Additions

Add new features and commands here. Examples:
- New Discord commands or integrations
- API integrations
- User-facing features

### Code Quality & Architecture

Add refactoring, technical improvements, and architectural enhancements here. Examples:
- Decoupling work
- Test coverage improvements
- Performance optimizations

---

## Priority Tiers

**Tier 1 (Do first — blocks major work)**
- Add items that are dependencies for other work

**Tier 2 (Do next — enables better DX)**
- Add items that improve developer experience

**Tier 3 (Nice to have — polish)**
- Add items that are nice-to-have improvements

---

## Movement Rules

- Items move from Backlog to an Execution Plan (see [active/](active/)) when work starts
- Mark complete with `[x]` when the PR merges and changes are live
- Move completed items to [completed/](completed/) as a closure ceremony
