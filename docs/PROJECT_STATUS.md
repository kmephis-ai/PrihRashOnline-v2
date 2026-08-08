# PrihRashOnline-v2 — current project status

This file is a public-safe human summary. The authoritative execution state remains GitHub Roadmap Issues + code/tests/workflows + machine evidence. Do not use this file to override a red machine gate.

## Current platform baseline

The following R0 engineering capabilities are already `DONE` and machine-verified:

- `TEST-001` deterministic synthetic finance fixtures;
- `SEC-001` synthetic-only public current tree;
- `SEC-002` security/privacy policy-as-code;
- `FIN-001` canonical financial reconciliation;
- `DATA-001` source-to-canonical migration reconciliation;
- `SEC-003` reproducible supply chain;
- `CI-001` zero-secret PR validation vs trusted deploy split;
- `CI-002` authenticated exact-SHA runtime verification;
- `CI-003` autonomous exact-head squash merge + Main Verification Issue close;
- `DR-001` portable encrypted owner backup + isolated restore drill;
- `OBS-001` bounded privacy-safe audit/telemetry baseline;
- `FINOPS-001` executable `FREE_ONLY` runtime/CI guard.

When this DOC-001 candidate reaches `main`, `DOC-001` is also `DONE` and `MASTER-G0 / Truth` is complete.

## R0 master gates

### MASTER-G0 / Truth

Required: `TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001`.

State after DOC-001 merge: **complete**.

### MASTER-G1 / Autonomous delivery + AI engineering contract

Delivery engine (`SEC-003 + CI-001 + CI-002 + CI-003`) is complete. Remaining R0 work is the AI Engineering contract chain:

1. `AIENG-001` — repository AI contract (`AGENTS.md` + public-safe AI context);
2. `AIENG-002` — Roadmap-to-agent executable task protocol;
3. `AIENG-003` — read-only multi-AI review protocol.

State: **open until AIENG-001..003 are DONE**.

### MASTER-G2 / Recoverability

Required: `DR-001 + OBS-001 + FINOPS-001`.

State: **complete**.

## R1 entry condition

Do not treat R1 feature/platform expansion as the current priority until all R0 master gates are complete.

After `MASTER-G1`, dependency-ordered R1 starts with:

1. `FIN-010` — versioned KPI Dictionary;
2. `DATA-010` — canonical transaction schema v1;
3. pure domain/application core and repository adapters;
4. deterministic full-history migration only after required backup/reconciliation dependencies.

## Current runtime truth

- private primary store/runtime: Google Sheets + Apps Script;
- family UI: private Apps Script Web Dashboard;
- public GitHub: source/policy/tests/docs + independently generated synthetic financial data only;
- DEV delivery: exact-SHA autonomous pipeline;
- PROD/cutover/destructive data operations: separate policy gates;
- paid-by-usage provider activation: blocked unless a future reviewed provider policy remains inside `FREE_ONLY` safety envelope;
- billable provider allowlist: empty at the FINOPS-001 baseline.

## What is deliberately not claimed

- full-history migration is **not** declared complete;
- Google -> Yandex cutover is **not** performed;
- private Dashboard is **not** made public for CI;
- public Git history remediation rewrite is **not authorized/executed**;
- paid cloud/AI/OCR provider is **not** enabled;
- old RC/release snapshot mechanics are **not** current delivery policy.

## Sources of truth precedence

Until AIENG-001 formalizes the repository AI contract, use this order for conflicts:

1. privacy/security/cost/irreversible policy boundaries;
2. canonical Roadmap Issue + dependencies/acceptance;
3. executable code/tests/workflows on the relevant exact SHA;
4. ADR/architecture/operations docs;
5. README/user docs;
6. historical changelog/release notes.

A stale lower-priority document never authorizes bypassing a current machine gate.
