# Core beliefs

Operating principles for the discord-worker repo. Adapted from the OpenAI
"Harness engineering" article, scaled to the actual size of this codebase.

---

## Humans steer; agents execute

Engineers define intent, set constraints, and validate outcomes. Agents do
the implementation work. When an agent produces bad output, the correct
response is to identify what was missing — a guardrail, a doc, a test — and
add it to the repo.

---

## The repo is the source of truth

Anything that is not in the repo effectively does not exist to a future agent.
Decisions made in chat, email, or someone's head are invisible. If a decision
matters, encode it here: as a doc, a test, a script, or a comment. Stale docs
that no longer reflect reality are worse than no docs; delete or correct them.

---

## `AGENTS.md` is a map, not an encyclopedia

A short entry point with pointers is more useful than a long manual. Context
is a scarce resource. When everything is "important," nothing is. Keep
`AGENTS.md` to ~100 lines and point into `docs/` for depth.

---

## Agent legibility is the goal

Write code and docs so a future agent can reason about the repo directly,
without needing external context. Prefer boring, composable, well-understood
tools. Avoid opaque dependencies whose behavior can't be read or tested
in-repo.

---

## Working software beats speculative architecture

Ship the simplest thing that works. Do not add indirection, layers, or
abstractions speculatively. New structure needs evidence: at least two real
call sites, or a concrete near-term second use case. Architecture astronaut
scaffolding before the repo needs it is a liability, not an asset.

---

## Prefer small, reversible changes

A small, testable change is safer than a large refactor. When uncertain,
ship the smaller version first. Avoid changes that are hard to roll back
without clear necessity.

---

## Invariants belong in tests and tooling, not prose

Important constraints should be encoded mechanically — as tests, type
signatures, or lint rules — not just written in a doc. Prose is for
reasoning; enforcement is for tooling. When a constraint is important enough
to repeat in every review, it is important enough to encode.

---

## Boundaries matter; premature layering does not

A layered architecture with explicit, enforced dependency directions is
the right long-term target. The desired structure is a directed acyclic graph:
dependencies point in intentional directions, with a limited set of allowed
edges.

But:
- **Do not create a layer before there is a real boundary to protect.**
- One call site does not justify a new abstraction.
- When a boundary becomes real, document the allowed dependency direction
  before adding the folder, framework, or enforcement rule.
- The current invariant: keep the Worker direct and shippable. Introduce new
  layers only when they reduce actual duplication, clarify a real boundary,
  or support a concrete second use case.

---

## Test harness setup is part of the product

The e2e and smoke test infrastructure under `test/e2e/` is not boilerplate
to be casually reorganized. It encodes how the Worker is tested against a
real Wrangler dev environment and a live URL. Understand it before touching it.

---

## Secrets and live config deserve care

`DISCORD_TOKEN`, `SIGNATURE_PUBLIC_KEY`, and `DISCORD_APPLICATION_ID` are
live credentials. The smoke test's `LIVE_BASE_URL` points at a running
deployment. Treat these carefully. Do not log them, do not commit them, and do
not make changes to live-credential handling without understanding the full path.

---

## Repeated mistakes should become docs, tests, or scripts

If an agent (or human) makes the same mistake twice, that is a signal: add a
doc, test, or guard to prevent the third occurrence. Do not rely on repeated
verbal reminders.

---

## Delete stale docs rather than preserving misleading ones

A doc that no longer reflects reality misleads future agents. If you find a
doc that is wrong or obsolete, correct it or delete it. A missing doc is
neutral; a wrong doc is actively harmful.

---

## New abstractions require evidence

Before adding a helper, service, wrapper, or layer: identify the two or more
concrete call sites that justify it. If you cannot name them, do not add the
abstraction. This applies to directory structure, interfaces, and utility
modules equally.
