# PrihRashOnline-v2 — current project status

This file is a public-safe human summary. The authoritative execution state remains GitHub Roadmap Issues + code/tests/workflows + machine evidence. Do not use this file to override a red machine gate.

## Current platform baseline

The following R0 engineering capabilities are `DONE` and machine-verified:

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
- `FINOPS-001` executable `FREE_ONLY` runtime/CI guard;
- `DOC-001` documentation truth reset + machine docs-drift gate.

When this AIENG-001 candidate reaches `main`, root `AGENTS.md` + public-safe AI context + machine AI-contract gate are also part of the verified baseline.

## R0 master gates

### MASTER-G0 / Truth

Required: `TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001`.

State: **complete**.

### MASTER-G1 / Autonomous delivery + AI engineering contract

Delivery engine (`SEC-003 + CI-001 + CI-002 + CI-003`) is complete.

After AIENG-001 merge the repository AI operating contract is complete. Remaining dependency-ordered R0 work:

1. `AIENG-002` — Roadmap-to-agent executable task protocol;
2. `AIENG-003` — read-only multi-AI review protocol.

State: **open until AIENG-002 and AIENG-003 are DONE**.

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

## Repository AI truth

Root `AGENTS.md` is the public-safe repository AI operating contract. `.ai-context/PROJECT_CONTEXT.md` and `llms.txt` are compact entry points; they must never become private user-memory/credential/finance stores.

AI agents must follow one-writer Roadmap lifecycle, exact machine gates and fail-closed source precedence. `DONE` means Main Verification closed the linked Issue, not merely that code was committed or merged.

## What is deliberately not claimed

- full-history migration is **not** declared complete;
- Google -> Yandex cutover is **not** performed;
- private Dashboard is **not** made public for CI;
- public Git history remediation rewrite is **not authorized/executed**;
- paid cloud/AI/OCR provider is **not** enabled;
- old RC/release snapshot mechanics are **not** current delivery policy;
- AIENG-002 task protocol and AIENG-003 multi-AI review are **not** complete until their own Roadmap items close.

## Sources of truth precedence

Repository AI source precedence is formalized in `AGENTS.md`. In short:

1. security/privacy/cost/irreversible policy boundaries;
2. canonical Master Audit / Executable Roadmap / AI Development Playbook when supplied;
3. active Roadmap Issue;
4. executable exact-SHA code/tests/workflows;
5. architecture/ADR/operations docs;
6. README/user docs;
7. historical changelog/release notes.

A stale lower-priority document never authorizes bypassing a current machine gate.
