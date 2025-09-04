# Parser scaffolding

This repo uses a Zod-backed Discord command parser:

- `DiscordCommandParser` parses Chat Input interactions only for now and normalizes options to a record.
- `schemas.ts` registers per-command Zod schemas in a shared registry used by the parser.
- `toDiscordResponse` maps our internal `InteractionResponse` union to Discord wire format.

Extend by adding schemas to `schemas.ts` or registering dynamically at startup.
