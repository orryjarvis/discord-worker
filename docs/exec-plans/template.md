# Execution Plan Template

Use this template when planning significant work. Execution plans are first-class artifacts that live in the repository and serve as a system of record for complex tasks.

---

## Goal

**One sentence:** What are we trying to achieve?

---

## Problem Statement

**2–3 paragraphs:** Why is this work important? What constraint or opportunity triggered this plan? What will change once complete?

---

## Approach

### High-Level Strategy

Describe the overall strategy without getting into step-by-step detail.

### Phases

Break the work into logical phases. Each phase should be independently valuable or enable the next one.

**Phase 1 — [Name]** *(parallel dependencies: None / [list]*  
Description and dependencies.

**Phase 2 — [Name]** *(depends on Phase 1)*  
Description and dependencies.

---

## Success Criteria

- [ ] Criterion 1 (e.g., "All enforcement scripts pass on clean codebase")
- [ ] Criterion 2
- [ ] Criterion 3

---

## Key Decisions

### Decision 1: [Question]

**Choice:** [Selected option]  
**Rationale:** Why this choice over alternatives?  
**Trade-offs:** What are the costs?

### Decision 2: [Question]

**Choice:** [Selected option]  
**Rationale:** Why this choice?  
**Trade-offs:** What are the costs?

---

## Known Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| [Risk] | [What happens] | [Low/Med/High] | [How we avoid it] |

---

## Progress Log

### Entry: [Date]
Status: [Planning / In Progress / Blocked / Complete]

- **Completed**: [What was done]
- **In Progress**: [What's being worked on]
- **Blocked**: [What's waiting, on what]
- **Next**: [What comes next]

---

## References

- [Link to related design doc](../design-docs/)
- [Link to architecture rules](../design-docs/architecture-rules.md)
- [Link to code directory](../../src/)

