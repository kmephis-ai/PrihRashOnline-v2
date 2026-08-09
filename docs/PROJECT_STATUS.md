# PrihRashOnline-v2 — current project status

This file is a public-safe human summary. Authoritative execution state remains GitHub Roadmap Issues + exact-SHA code/tests/workflows + machine evidence. Never use this file to override a red gate.

## R0 capabilities already DONE

- `TEST-001`, `SEC-001`, `SEC-002`;
- `FIN-001`, `DATA-001`;
- `SEC-003`, `CI-001`, `CI-002`, `CI-003`;
- `DR-001`, `OBS-001`, `FINOPS-001`;
- `DOC-001` documentation truth reset;
- `AIENG-001` root machine-enforced repository AI contract;
- `AIENG-002` executable Roadmap-to-agent task protocol.

## R0 master gates

### MASTER-G0 / Truth

`TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001` — **complete**.

### MASTER-G1 / Autonomous delivery + AI engineering

Delivery engine (`SEC-003 + CI-001 + CI-002 + CI-003`) is complete.

AIENG chain state:

- `AIENG-001` — repository AI contract: **DONE**;
- `AIENG-002` — Roadmap-to-agent executable task protocol: **DONE**;
- `AIENG-003` — exact-candidate read-only multi-AI review: final R0 item; it becomes **DONE only after its own Main Verification**.

Until AIENG-003 Main Verification closes Issue #72, `MASTER-G1` remains open. After that close, `MASTER-G1` and the full R0 exit condition are complete.

### MASTER-G2 / Recoverability

`DR-001 + OBS-001 + FINOPS-001` — **complete**.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract.

- `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` resolve continuation, one-writer ownership and lifecycle.
- `tools/multi-ai-review-protocol.js` + `PRH_MULTI_AI_REVIEW_PACKET_V1` / `PRH_MULTI_AI_REVIEW_REPORT_V1` define supplementary exact-candidate review.
- required reviewer roles: architecture, security/privacy, financial/data, test/operations;
- reviewers are `READ_ONLY`, `writer_authority=false` and cannot mark Roadmap DONE;
- unresolved P0/P1 blocks review evidence; P2/P3 remains advisory;
- conflict resolution follows policy/spec/tests/ADR, never model voting;
- required review contracts are deterministic local Node checks and require no paid AI/API provider.

## R1 entry condition

Do not treat R1 feature/platform expansion as current priority until all R0 master gates are complete. When Issue #72 is machine-closed, dependency-ordered R1 starts with:

1. `FIN-010` — versioned KPI Dictionary;
2. `DATA-010` — canonical transaction schema v1;
3. pure domain/application core and repository adapters;
4. deterministic full-history migration only after recovery/reconciliation dependencies.

## Current runtime truth

- private primary store/runtime: Google Sheets + Apps Script;
- family UI: private `MYSELF` Apps Script Web Dashboard;
- public GitHub finance content: independently generated synthetic only;
- DEV delivery: exact-SHA autonomous pipeline;
- PROD/cutover/destructive data actions: separate policy gates;
- paid-by-usage provider activation: blocked unless a future reviewed provider policy remains inside `FREE_ONLY`;
- billable provider allowlist: empty at FINOPS-001 baseline.

## What is deliberately not claimed

- full-history migration is **not** complete;
- Google -> Yandex cutover is **not** performed;
- private Dashboard is **not** made public for CI;
- public Git history rewrite is **not authorized/executed**;
- paid cloud/AI/OCR provider is **not** enabled;
- old RC/release snapshot mechanics are **not** current delivery policy;
- AI review does **not** replace machine gates or create reviewer write authority.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. canonical Master Audit / Executable Roadmap / AI Development Playbook when supplied;
3. active Roadmap Issue/task packet;
4. executable exact-SHA code/tests/workflows;
5. architecture/ADR/operations docs;
6. README/user docs;
7. historical changelog/release notes.

A stale lower-priority document never authorizes bypassing a current machine gate.
