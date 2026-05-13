---
applyTo: "src/**/*.ts,test/**/*.ts,scripts/**/*.ts"
---

# Architecture Skill

Use this instruction set for changes that can affect module boundaries, naming, or dependencies.

## Primary References

- [AGENTS.md](../../AGENTS.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/design-docs/architecture-rules.md](../../docs/design-docs/architecture-rules.md)

## Boundary Rules

- Commands may depend on services and shared types.
- Services must not depend on commands.
- Avoid circular imports.
- Keep shared types in `src/types/` where reuse is needed.

## File Layout Rules

- Commands belong in `src/commands/`.
- Services belong in `src/services/`.
- Tests mirror source intent under `test/` and `test/e2e/`.

## Change Checklist

1. Confirm affected modules still obey import direction.
2. Check naming and placement conventions.
3. Update docs when architectural behavior changes.
4. Run local checks to catch drift.

## Anti-Patterns to Avoid

- Cross-command coupling.
- Services containing Discord interaction formatting.
- Utility modules that become hidden dependency hubs.
- Silent fallback behavior that masks architectural violations.

## Definition of Done

- Dependency graph remains acyclic.
- New files match naming/location conventions.
- Architecture docs remain accurate.
- Local checks pass.
