# Design docs

This directory is the design-doc system of record for the discord-worker repo.

Design docs capture stable decisions, operating principles, and real dependency
boundaries. They are not a place for speculation, tutorials, or generated
content.

---

## Current docs

| File | Purpose |
|---|---|
| [core-beliefs.md](core-beliefs.md) | Agent-first operating principles for this repo |

---

## When to add a design doc

- A design decision keeps being re-litigated and needs a stable written answer.
- Agents repeatedly make the same mistake that a short doc would prevent.
- A real architectural boundary has emerged and needs its allowed dependency
  directions documented before enforcement is added.
- An operating assumption (about the runtime, deployment, or test setup) is
  non-obvious and worth writing down once.

---

## When not to add a design doc

- The decision is obvious from reading the code.
- The feature does not exist yet and may never exist.
- The doc would describe a future architecture the repo does not yet have.
- You are documenting a one-off implementation choice rather than a stable
  principle.

---

## Future docs

A layering/architecture doc is appropriate once the codebase has enough real
structure to justify one — for example, when there are multiple commands,
service integrations, or deployment targets with distinct dependency
requirements. At that point, the doc should describe allowed dependency
directions before any enforcement is added.

Do not create that doc preemptively.
