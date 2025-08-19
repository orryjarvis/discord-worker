# Agent Guide: Discord Worker Bot Repository

## Repository Ideals & Standards

- **Separation of Concerns:** Each module should have a single responsibility (e.g., command logic, API integration).
- **Cohesion:** Related logic is grouped together (e.g., each command in its own file).
- **Decoupling:** Modules interact via interfaces or the registry, not direct imports of implementation details.
- **Discoverability:** All commands are registered in `src/commands/registry.ts`.
- **Extensibility:** New commands can be added by creating a new file in `src/commands/` and registering it.
- **Documentation:** Every module and command should have a docstring and/or README entry.
- **Test Coverage:** Each command should have its own unit and integration tests in `test/commands/`.

## How to Build a New Command

1. Create a new file in `src/commands/` (see `commandTemplate.ts`).
2. Implement the command handler function, following the template and standards.
3. Register the command in `src/commands/registry.ts`.
4. Add unit and integration tests in `test/commands/`.
5. Document the command in the file and update `docs/overview.md` if needed.

## Prompt Example
> Build a new command that does ____

The agent should:
- Use the template in `src/commands/commandTemplate.ts`.
- Register the command in `src/commands/registry.ts`.
- Add tests in `test/commands/`.
- Follow all standards above.

## Starting Points for Agents
- `src/commands/commandTemplate.ts` — Command implementation template
- `src/commands/registry.ts` — Command registration
- `test/commands/commandTemplate.test.ts` — Test template
- `docs/AGENT_GUIDE.md` — This guide
