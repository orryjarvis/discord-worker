# Project Quality & Health

This document tracks code quality, test coverage, and technical health of discord-worker. It serves as a dashboard for agents and maintainers to understand project state and prioritize work.

**Last Updated:** 2026-05-13  
**Overall Health:** 🟡 Baseline (harness setup in progress)

---

## 📊 Key Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Unit Test Coverage** | 80% | TBD | 🔄 *To measure* |
| **Integration Test Coverage** | 70% | TBD | 🔄 *To measure* |
| **Type Checking Pass Rate** | 100% | 100% | ✅ Passing |
| **Lint Pass Rate** | 100% | 100% | ✅ Passing |
| **Architectural Rule Compliance** | 100% | TBD | 🔄 *To enforce* |
| **Documentation Freshness** | ≥95% | 80% | 🟡 Baseline |

---

## ✅ Quality Gates

### Pre-commit (Local Validation)

Developers and agents must pass these before pushing:

```bash
npm run check     # TypeScript type checking
npm run lint      # ESLint + custom architecture linting
npm test          # Unit + integration tests
npm run e2e       # End-to-end tests
```

If any gate fails, agent should diagnose using [docs/references/error-messages.md](./docs/references/error-messages.md) and self-correct before requesting review.

### CI/CD Pipeline

Automated checks on every PR:

- [ ] Type checking (`npm run check`)
- [ ] Linting (`npm run lint`)
- [ ] Unit tests (`npm test`)
- [ ] E2E tests (`npm run e2e`)
- [ ] Coverage thresholds (per-file, per-domain)
- [ ] Architecture rules (custom linter)
- [ ] Documentation lint (links, refs, freshness)

---

## 🧪 Test Coverage by Domain

*Note: Coverage data will be collected as Phase 1 progresses.*

| Domain | Files | Coverage | Target | Gap | Owners |
|--------|-------|----------|--------|-----|--------|
| **Commands** | `src/commands/` | TBD | 85% | — | Engineering |
| **Services** | `src/services/` | TBD | 80% | — | Engineering |
| **Core** | `src/{app,auth,commands,factory,loader}.ts` | TBD | 90% | — | Engineering |
| **E2E** | `test/e2e/` | TBD | 70% | — | Engineering |

---

## 🐛 Known Issues & Debt

| Issue | Priority | Owner | Target |
|-------|----------|-------|--------|
| Coverage measurement not automated | High | Engineering | Phase 4b |
| Error messages not standardized | High | Engineering | Phase 4b |
| No architectural linter | High | Engineering | Phase 4a |
| Documentation not auto-validated | Medium | Engineering | Phase 4b |
| Test output not structured | Medium | Engineering | Phase 4b |

See [docs/exec-plans/tech-debt.md](./docs/exec-plans/tech-debt.md) for full backlog.

---

## 🏗️ Harness Engineering Progress

Tracking progress toward the agent-harness initiative (see [docs/exec-plans/active/agent-harness.exec-plan.md](./docs/exec-plans/active/agent-harness.exec-plan.md)):

### Phase 1 — Knowledge Foundation

- [x] Create docs/ directory structure (design-docs/, references/, exec-plans/)
- [x] Create AGENTS.md (TOC)
- [x] Create ARCHITECTURE.md (system design)
- [ ] Create design-docs/ files (commands, services, testing, error-handling, architecture-rules)
- [ ] Create references/ files (local-dev, error-messages, code-patterns, glossary)
- [ ] Refactor copilot-instructions.md to point to AGENTS.md

### Phase 2 — Agent Skills

- [ ] Create .github/instructions/*.instructions.md files

### Phase 3 — Workflow Prompts

- [ ] Create .github/prompts/*.prompt.md files

### Phase 4a — Architecture Enforcement

- [ ] Build linting scripts
- [ ] Integrate into CI/CD

### Phase 4b — Observability & Agent Feedback Loop

- [ ] Design legible error formats
- [ ] Standardize test output
- [ ] Add coverage tracking
- [ ] Document local validation loop

---

## 📈 Trends & Notes

### Recent Changes

- **2026-05-13:** Phase 1 kickoff; created exec-plan, established knowledge foundation structure

### Observations

- Project is well-structured for agent development (clear separation of concerns)
- Existing tests provide good foundation for coverage measurement
- Error messages are cryptic; need standardization for agent self-correction
- Documentation is scattered; Phase 1 consolidating into discoverable system

---

## 🔧 For Maintainers

### Updating This Document

Update this quarterly or when:

- A major phase completes
- Coverage thresholds change
- A critical issue is discovered
- New metrics are added

### Adding New Metrics

1. Define target (what is "good"?)
2. Add measurement script (if automated)
3. Document how agents should interpret it
4. Add to this dashboard

### Review Cadence

- **Weekly:** Check phase progress (Phase 1–4)
- **Monthly:** Review quality metrics, update trends
- **Quarterly:** Comprehensive health review; adjust priorities

---

## 📞 Contact & Escalation

- **Questions about architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md) or ask in issue
- **Coverage/testing questions:** See [docs/design-docs/testing.md](./docs/design-docs/testing.md)
- **Lint/quality failures:** See [docs/references/error-messages.md](./docs/references/error-messages.md)
- **General project health:** Raise an issue or update this document

---

## References

- [Execution Plan: Agent Harness Engineering](./docs/exec-plans/active/agent-harness.exec-plan.md)
- [Tech Debt Backlog](./docs/exec-plans/tech-debt.md)
- [AGENTS.md](./AGENTS.md) — Start here for agent guidance
