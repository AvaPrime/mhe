# MHE_CODEX: Experimental Biosynthetic Memory Layer

> Protocol & guardrails for incubating “living memory” features *separately* from the stable Memory Harvester Engine (MHE Core).

---

## Purpose
- **MHE Core** remains a reliable ingestion + recall backbone.
- **MHE Codex (this branch)** is a safe R&D lane for high‑leverage features (codestones, resonance, reflection, federation) without destabilizing Core.

---

## Non‑Negotiables (Read First)
1. **Isolation:** All Codex work happens in a dedicated branch named `feature/codex/<scope>` and the long‑lived integration branch `codex`.
2. **No cross‑contamination:** Core codepaths may depend on Codex **only** via feature flags and versioned APIs. Never import experimental modules directly into Core.
3. **Reverse dependency only:** Codex may call Core services, not the other way around.
4. **Fail‑closed:** If a flag or Codex service is missing/unhealthy, Core behavior must remain unchanged.
5. **Evidence before merge:** A Codex feature must ship with benchmarks, migration notes, and a rollback plan before graduating to Core.

---

## Branching & Release Model

### Branches
- `main` → Production‑ready MHE Core only
- `develop` → Staging for upcoming Core releases
- `codex` → Long‑lived integration branch for experimental features
- `feature/codex/<scope>` → Short‑lived topic branches for each experiment (e.g., `feature/codex/codestones`, `feature/codex/resonance`)

### PR Rules
- `feature/codex/*` → **into** `codex` (never into `develop`/`main` directly)
- Graduations: `codex` → `develop` via **Merge Proposal PR** with:
  - RFC link + architecture notes
  - Perf + quality benchmarks
  - Data model diffs + migrations
  - Rollback plan
  - Ops runbook & dashboards

### CI Policy
- `main`/`develop`: Codex tests **skipped** unless `CODEX_ENABLED=true` in matrix step
- `codex`: full matrix including experimental tests, mutation tests, fuzzers
- Required checks for `codex` → `develop`:
  - Unit + integration (Core unaffected when flags off)
  - Perf regression gates (P95 lat/throughput ≤ Core baseline + X%)
  - Security (SAST, secrets, SBOM, license compliance)
  - Data‑migration dry‑run + rollback rehearsal

### Feature Flags
- All Codex features are behind **dynamic flags** (e.g., `codex.codestones.enabled`, `codex.recall.resonance.enabled`).
- Flags are **read by Core** but default **false**.
- Flags must support per‑tenant/per‑request overrides.

---

## Architecture (High‑Level)

```
+------------------------+         +------------------------------+
|        MHE Core        |  --->   |       Codex Services         |
|  Ingest | Index | API  |         |  Distill | Recall | Reflect  |
+------------------------+         +------------------------------+
       ^        |                             ^
       |        v                             |
   Postgres  + pgvector                Codex store (tables/streams)
```

- **Core** provides canonical ingestion, storage, and baseline search.
- **Codex** layers:
  - **Distillation (Codestones):** deterministic transformation of raw shards → stable semantic artifacts
  - **Resonant Recall:** hybrid retrieval across fidelity (exact), resonance (semantic), and context (graph/temporal)
  - **Reflection:** scheduled synthesis/compaction, pattern formation, self‑tuning
  - **Federation (later):** opt‑in exchange across tenants/nodes

---

## Data Model Additions (Codex‑only)
- `codestone`: { id, source_ids[], summary, rationale, tags[], embedding, provenance{hash, origin, ts}, quality_scores{signal, novelty, trust}, version }
- `codex_link`: { from_id, to_id, type (temporal|semantic|provenance|task), weight }
- `resonance_profile`: { tenant_id, factors{recency, intent, persona}, learned_weights }

> **Note:** Codex tables live under a separate schema `codex_*` and must not be queried by Core paths unless via read‑only APIs.

---

## Initial Experiments (in `feature/codex/*`)

### 1) Codestones (distillation pipeline)
- **Goal:** convert harvested shards → normalized, durable semantic units
- **Inputs:** message shards, code blocks, docs (from Core)
- **Outputs:** `codestone` rows + backlinks to sources
- **Accept:** P99 distillation ≤ 500ms/object; determinism score ≥ 0.95 on test canon

### 2) Resonance Channels
- **Goal:** three‑lane recall: `precision` (BM25), `resonance` (vector ANN), `context` (graph/temporal)
- **Accept:** blended MRR/NDCG uplift ≥ 15% vs Core baseline on gold queries; latency budget ≤ +30% P95

### 3) Reflection Jobs
- **Goal:** nightly/weekly compaction, pattern mining, link aging
- **Accept:** storage growth ≤ Core + 20%/month; quality scores trend upward; rollback OK

### 4) Governance & Provenance Hooks
- **Goal:** OPA/Rego policies enforce who can create/see/use Codex artifacts
- **Accept:** policy coverage for create/read/delete; provable denial tests

---

## Interfaces & Isolation Contracts

### Core → Codex (allowed)
- gRPC/HTTP: `/codex/distill`, `/codex/recall`, `/codex/reflect`
- Async bus: `codex.distill.request`, `codex.reflect.tick`

### Codex → Core (allowed)
- Read‑only: `/core/shards/{id}`, `/core/search`, `/core/tenants/{id}`

### Not allowed
- Core importing Codex modules/classes
- Codex writing to Core tables directly (use service APIs)

---

## Observability & Ops
- Dashboards: `codex/throughput`, `codex/latency_p95`, `codex/quality_scores`, `codex/flag_adoption`
- Alerts: distillation failure rate, recall error spikes, migration drift
- Runbooks: enable/disable flags, emergency rollback, data backfill

---

## Graduation Criteria (Codex → Core)
A feature is eligible to merge from `codex` → `develop` when it has:
1. **Demonstrated value:** offline benchmarks + online A/B uplift
2. **Safety:** migrations + rollbacks rehearsed; dark‑launch tested
3. **Docs:** user‑facing guide + ops runbook + API reference
4. **Flags:** default off in Core, staged rollout plan per tenant

---

## Developer Workflow (Step‑by‑Step)
1. `git checkout -b feature/codex/<scope>`
2. Build only Codex services/modules under `/codex/*` or `apps/codex-*`
3. Guard all new call‑sites behind flags
4. Add tests: determinism, perf, security, policy
5. Open PR → `codex` with RFC + dashboards links
6. Run A/B in staging (`develop` unaffected); publish report
7. If accepted, open Merge Proposal PR from `codex` → `develop`

---

## Directory & Flag Conventions
```
apps/
  core-api/
  core-worker/
  codex-api/
  codex-worker/
packages/
  core-shared/
  codex-shared/
configs/
  flags/
    codex.yaml
migrations/
  codex/
```
Flag keys: `codex.*` (booleans), `codex.weights.*` (floats), `codex.beta.tenants` (list)

---

## Security & Privacy
- Separate secrets for Codex services
- Row‑level security for `codex_*` tables
- PII handling policies enforced by OPA
- Provable deletion path for Codex artifacts

---

## Roadmap (90 Days)
- **Weeks 1–3:** Codestones MVP (distill → store → recall); flags + dashboards
- **Weeks 4–6:** Resonance blend (BM25 + ANN) with offline evals
- **Weeks 7–9:** Reflection jobs + link graph; aging policies
- **Weeks 10–12:** Governance + provenance E2E tests
- **Weeks 13–14:** A/B in staging; SLOs & rollback rehearsals
- **Weeks 15–12 (typo → 15–18):** Graduation review → selective merge to Core

---

## Definition of Done (per experiment)
- Spec → Tests → Benchmarks → Docs → Runbook → Rollback → Flagged rollout plan

---

## Appendix: RFC Template
- Problem & background
- Proposed design (diagrams, schemas)
- Alternatives considered
- Risks & mitigations
- Migration/rollback
- Observability plan
- Security & privacy review
- Testing & acceptance metrics

---

**Final Reminder:** Codex is a *garden*, not a dumping ground. Keep shoots pruned, measure growth, and only transplant into Core when the roots are strong.

