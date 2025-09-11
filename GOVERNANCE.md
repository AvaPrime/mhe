# GOVERNANCE.md — Memory Harvester Engine (MHE)

This document explains how humans, autonomous agents, and automated systems collaborate safely and productively in this repository. It unifies the standards defined in **CONTRIBUTING.md**, **AGENTS.md**, and our **CI/CD workflows**.

---

## Purpose
Our goal is to maintain a **high-quality, secure, and sustainable codebase** while enabling contributions from both human developers and autonomous coding agents. Governance ensures:

- **Consistency**: All contributors follow the same standards
- **Safety**: Security, data, and performance guardrails are enforced
- **Accountability**: Every change is reviewable, testable, and reversible
- **Clarity**: Humans and agents know their roles, boundaries, and escalation paths

---

## Governance Layers

### 1. Human Contributors
- Guided by **CONTRIBUTING.md**
- Focus: new features, design decisions, architecture, and complex changes
- Responsibilities:
  - Write clear, maintainable code with tests and documentation
  - Review PRs from other humans and agents
  - Escalate issues beyond agent scope
  - Approve/decline higher-risk proposals

### 2. Autonomous Agents
- Governed by **AGENTS.md**
- Focus: low-to-medium risk, repetitive, and well-scoped tasks
- Responsibilities:
  - Only perform tasks explicitly approved in AGENTS.md
  - Follow strict constraints (scope, data safety, security, performance)
  - Track metrics (#AGENT-METRICS in PRs)
  - Defer to humans on ambiguous or high-risk tasks

### 3. CI/CD Workflows
- Defined in `.github/workflows/ci.yml`
- Acts as **the gatekeeper**: no code merges without passing quality gates
- Responsibilities:
  - Enforce linting (ruff), formatting, typing (pyright), and testing (pytest)
  - Build and validate docs (optional)
  - Verify package distributions on tagged releases
  - Block merges if any check fails

---

## Risk Management

### 🟢 Low Risk (agents + humans)
- Dependency updates (patch/minor only)
- Docstring improvements
- Unit tests for pure functions
- README/docs maintenance
- Small bugfixes with tests

### 🟡 Medium Risk (agents propose, humans approve)
- New ingestion adapters
- Performance optimizations with benchmarks
- Test infrastructure improvements

### 🔴 High Risk (human-led only)
- API/architecture changes
- Database migrations
- Large-scale refactors
- Security-critical modifications

---

## Security & Safety

- **Secrets**: Never committed. Always use env vars or mocked values in tests.
- **Dependencies**: Minimize additions. All new deps require justification + license check.
- **Data Safety**: No destructive migrations without human-reviewed rollback plan.
- **Performance**: Optimizations must include before/after benchmarks.
- **Emergency Protocols**:
  - If an agent breaks something → immediate revert + notify code owners
  - If CI is down → no merges allowed until restored

---

## Pull Request Governance

- All PRs use the shared template (`.github/pull_request_template.md`)
- CI must pass on every PR
- Reviews:
  - Human PRs: at least one maintainer approval
  - Agent PRs: always require human review + metrics
- Merge policy:
  - Squash merges preferred for clean history
  - No force-pushes to protected branches (main, develop)

---

## Review Ownership

- **General Code**: @Phoenix, @<maintainer2>
- **Security Reviews**: @<security-owner>
- **Data/Migration Reviews**: @<data-owner>
- **Docs/Community**: Maintainers + contributors with write access

---

## Roadmap Alignment

Governance prioritizes contributions that:
1. Reduce technical debt (tests, docs, types, dependency hygiene)
2. Improve developer experience (tooling, documentation clarity)
3. Strengthen stability (bug fixes, performance safeguards)

High-risk features or architectural work must follow an **RFC (Request for Comments)** process before implementation.

---

## Conclusion

Governance at MHE ensures humans and agents work **in harmony**:
- Humans lead strategy, design, and high-risk changes
- Agents handle repetitive, low-risk, high-value tasks
- CI/CD enforces quality and safety at all times

Together, this forms a resilient development process that is secure, productive, and future-proof.
