# Execution Plan: Agent Harness Engineering

**Status:** Planning  
**Created:** 2026-05-13  
**Owner:** Engineering Team

---

## Goal

Design and implement a harness that enables agents to make large, correct changes to the discord-worker codebase reliably, with humans steering intent and agents executing—modeled after OpenAI's harness engineering approach.

---

## Problem Statement

The discord-worker codebase is about to undergo major changes to the Discord bot logic. Without proper scaffolding, agent-driven development can produce:

- Inconsistent patterns and naming conventions
- Import violations and architectural drift
- Incomplete test coverage and documentation
- Time wasted on rework rather than validation

OpenAI's "Harness Engineering" write-up (Feb 2026) demonstrates that the solution is not better prompts—it's better *structure*: in-repo knowledge systems, targeted skills, workflow orchestration, and mechanical enforcement.

By building this harness now, we enable agents (and humans) to work at the abstraction level of intent ("add a Reddit command") rather than implementation details ("wire up DI, update tests, register in commands.ts, update docs, etc."). This compounds over time.

---

## Approach

### High-Level Strategy

1. **Build in-repo knowledge base** — All agent-accessible context lives in the repo as markdown. AGENTS.md becomes a map, not an encyclopedia. Architecture rules, design decisions, and tech debt are explicit and discoverable.

2. **Create targeted agent skills** — VS Code `.instructions.md` files inject domain-specific guidance when agents open relevant files. No generic rules—every skill teaches a concrete pattern.

3. **Define workflow prompts** — Reusable `.prompt.md` files orchestrate multi-step agent workflows (e.g., "new command from scratch to PR").

4. **Enforce mechanically** — Custom linters and structural tests ensure agents follow rules automatically. Error messages cite the relevant design docs, creating a feedback loop.

5. **Design feedback loops for local validation** — Agents must be able to run tests, linters, and type checks locally and understand failure reasons. Error messages and test output must be legible (structured, not cryptic). This enables the Ralph Wiggum Loop: run → validate → get signal → fix → repeat.

6. **Make observability legible to agents** — Logs, test failures, coverage reports, and type errors are all agent-readable inputs. Structured format matters: plain language, actionable remediation, citations to docs.

7. **Track progress as first-class artifact** — This plan and its siblings live in `docs/exec-plans/` and serve as the system of record.

### Phases

**Phase 1 — Knowledge Foundation** *(parallel, no interdependencies)*

Create the in-repo knowledge system: AGENTS.md (root TOC), ARCHITECTURE.md, QUALITY.md, expanded `docs/` with design-docs/, references/, and exec-plans/ structure. Refactor copilot-instructions.md to be a pointer.

**Phase 2 — Agent Skills** *(depends on Phase 1 docs)*

Create `.github/instructions/*.instructions.md` files scoped to specific domains: add-command, add-service, testing, architecture, ci-cd. Each skill is a targeted how-to that references relevant docs from Phase 1.

**Phase 3 — Workflow Prompts** *(parallel with Phase 2)*

Create `.github/prompts/*.prompt.md` files: new-command, new-service, code-review, doc-gardening, tech-debt-item, exec-plan. These orchestrate multi-step agent workflows.

**Phase 4a — Architecture Enforcement** *(depends on Phase 1 rules)*

Build enforcement tooling: `scripts/lint-architecture.ts`, `scripts/lint-docs.ts`, `test/architecture.test.ts`. Update CI pipeline to run these on every PR. Error messages are prescriptive, citing design docs.

**Phase 4b — Observability & Agent Feedback Loop** *(parallel with Phase 4a; depends on Phase 1 docs)*

Design and implement legible feedback signals so agents can validate locally and self-correct within the Ralph Wiggum Loop:
- Standardize test output format (failures are plain-English, actionable, include file:line context)
- Create structured error messages from linters (cite docs, suggest fixes, include context)
- Add coverage tracking and reporting (per-file visibility, threshold gates, CI reports)
- Document how agents run `npm test`, `npm run lint`, `npm run check` locally and interpret output
- Create error message reference in `docs/references/error-messages.md` showing agents what failures look like and how to fix them
- Ensure CI job output is captured and parseable (not just pass/fail bubbles)

---

## Success Criteria

- [ ] `AGENTS.md` exists at repo root and is ~100 lines (table of contents, not encyclopedia)
- [ ] All knowledge lives in `docs/` with clear structure: design-docs/, references/, exec-plans/
- [ ] `.github/instructions/` contains 5 skill files; each is <200 lines and teaches one concrete pattern
- [ ] `.github/prompts/` contains 6 workflow files; each is tested to work end-to-end
- [ ] `scripts/lint-architecture.ts` and `lint-docs.ts` exist and pass on clean codebase
- [ ] `test/architecture.test.ts` passes; covers file naming, import rules, test coverage
- [ ] CI pipeline includes `architecture` and `doc-lint` jobs that block `release-test`
- [ ] Test failures are human/agent-readable (plain English, actionable remediation, file:line citations)
- [ ] Coverage tracking is visible (Vitest reports per-file coverage; CI gates coverage % for new code)
- [ ] Lint errors include context: rule name, file:line, why, how to fix, and link to `docs/design-docs/architecture-rules.md`
- [ ] Documentation exists: `docs/references/local-dev.md` teaches agents how to run and interpret `npm test`, `npm run lint`, `npm run check`
- [ ] Error message examples in `docs/references/error-messages.md` show agents what they'll see when things go wrong and how to fix them
- [ ] Agent successfully adds a trivial "ping" command end-to-end using `new-command.prompt.md` without custom guidance, validates locally, sees clear signals
- [ ] All existing docs still pass linting and CI

---

## Key Decisions

### Decision 1: Agent Tooling

**Choice:** GitHub Copilot (VS Code)  
**Rationale:** User is actively developing in VS Code with Copilot. VS Code `.instructions.md` files are auto-injected into context when matching files are open—minimal friction, high legibility.  
**Trade-offs:** Copilot CLI / Codex CLI would require different formats (AGENTS.md, separate Skills/ dir). Design is modular enough that extending to other tooling later is feasible.

### Decision 2: Enforcement Strictness

**Choice:** Heavy (linters + structural tests + quality grades)  
**Rationale:** Agent velocity compounds with clear guardrails. Custom linters are relatively cheap (100–200 lines per script). The QUALITY.md tracker lets humans see gaps over time and plan accordingly.  
**Trade-offs:** Upfront cost: ~15 files created, ~1000 lines of tooling code. Benefit: agents work confidently within constraints, fewer review cycles.

### Decision 3: AGENTS.md vs copilot-instructions.md

**Choice:** Both coexist; AGENTS.md is the universal entry point  
**Rationale:** AGENTS.md is discoverable by any agent or human reading the repo. copilot-instructions.md remains as VS Code-specific supplemental guidance.  
**Trade-offs:** Two entry points could be confusing. Mitigated by: copilot-instructions.md explicitly points to AGENTS.md; AGENTS.md is in the .gitignore-adjacent "most important files" list.

### Decision 4: Execution Plans Location

**Choice:** `docs/exec-plans/` with active/, completed/, tech-debt.md subdirectory structure  
**Rationale:** Matches OpenAI model. Keeps all versioned plans co-located in the repo. tech-debt.md replaces TODO.md as the source of truth for backlog items.  
**Trade-offs:** Another level of indirection vs a flat TODO.md. Benefit: plans are first-class, searchable, and archival.

### Decision 5: Local Validation Loop Design

**Choice:** Agents run full test suite locally; error messages are prescriptive and cite docs  
**Rationale:** OpenAI's Ralph Wiggum Loop requires agents to validate changes before requesting review. Without legible feedback, agents can't diagnose failures and will ask humans for help instead of self-correcting.  
**Trade-offs:** 
- Investment: ~100 lines in error message formatting, 200 lines in coverage reporting config
- Benefit: Agents can self-correct; 80%+ fewer review cycles on "fix the lint error" feedback

### Decision 6: Coverage Thresholds & Observability

**Choice:** Enforce minimum coverage per changed file; report per-domain averages in QUALITY.md; design structured, actionable error output  
**Rationale:** Agents need guardrails on testing thoroughness. A blanket "80% project coverage" is vague; per-file thresholds are actionable. Structured error output (plain text, citations, remediation hints) is essential for feedback loop.  
**Trade-offs:** Stricter than most teams. More upfront config work. Benefit: Prevents drift, enables self-correction, compounds as agents add code.

---

## Known Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Phase 1 docs become stale quickly | Agents work with outdated context | Medium | Implement `doc-gardening.prompt.md` in Phase 3 to scan and refresh docs. Add CI job to catch stale references. |
| Agent can't diagnose test failures | Agent requests human help instead of self-fixing | Medium | Design legible error formats. Document expected failures in `docs/references/error-messages.md`. Test feedback loop on simple PR. |
| Local test runs are slow | Agents abandon validation, skip checks | Low | Profile test suite. Run only affected tests in pre-commit. Keep linters <500ms. |
| Coverage thresholds are too strict | Agents churn on tests instead of features | Medium | Set thresholds based on project norms (e.g., 80% on new code, 70% overall). Review quarterly in QUALITY.md. |
| ESLint/Vitest rules are hard to diagnose | Agent frustration, slower iteration | Low | Error messages must be prescriptive and cite docs. lint-architecture.ts output is plain English, not cryptic codes. |
| Skills files are too generic | Agents don't follow patterns | Medium | Every skill must include 2–3 concrete code examples, not abstractions. Test each skill on a simple PR before declaring it done. |
| Enforcement rules slow down local dev | Humans avoid linting | Low | Make lint scripts fast (<1s). Run only relevant checks in pre-commit (if we add one). |

---

## Progress Log

### Entry: 2026-05-13 — Planning

**Status:** Planning / Ready for Phase 1

- **Completed:** 
  - Studied OpenAI harness engineering write-up
  - Audited existing repo structure and CI/CD
  - Designed 4-phase approach
  - Gathered user input (agent tooling: Copilot; enforcement: heavy)
  
- **In Progress:** 
  - Creating execution plan document (this file)
  - Setting up exec-plans/ directory structure
  - Incorporating observability & testing feedback loop (Ralph Wiggum Loop)
  
- **Next:** 
  - Phase 1: Create knowledge foundation (AGENTS.md, architecture docs, design-docs, references)
  - Phase 4b: Design test output legibility + error message format (critical for agent feedback loop)
  - Phase 2: Create agent skills
  - Phase 3: Create workflow prompts
  - Phase 4a: Build enforcement tooling

---

## References

- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/) — Foundational reference
- [Current Copilot Instructions](.github/copilot-instructions.md) — To be refactored
- [Architecture](../architecture.md) — Current system design
- [TODO](../TODO.md) — Source of tech debt items
- [Vitest Config](vitest.config.ts) — Test infrastructure
- [CI/CD Pipeline](.github/workflows/ci.yaml) — Current validation gates

