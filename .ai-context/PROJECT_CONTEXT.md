# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, owner-private mapper/snapshot/state/diagnostic/repair/execution payload здесь запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **каноническая Executable GitHub Roadmap v2.3**.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Architecture/ADR/operations docs.

Chat history/memory и stale Roadmap copies not authority. При явном предоставлении `Master Audit v2.1` и `AI Development Playbook v1.0` действует precedence из `AGENTS.md`.

## Current R0 truth

R0 machine-proven complete. `MASTER-G0`, `MASTER-G1`, `MASTER-G2` закрыты. AIENG chain: `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

## Current R1 truth

- `FIN-010` — DONE.
- `DATA-010` — DONE.
- `ARCH-010` — DONE, Issue #89 Main Verification PASS.
- `ARCH-011` — DONE, Issue #91 Main Verification PASS.
- `MIG-010` — DONE, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` evidence retained historically.
- `ANL-010` — DONE, Issue #98 Main Verification PASS.
- `TEST-010` — DONE, Issue #100 Main Verification PASS.
- `OBS-010` — **current P1 writer**, Issue #103, branch `agent/OBS-010-slo-error-budget-layer`.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository port. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## OBS-010 SLO/error-budget boundary

`PRH_SLO_ERROR_BUDGET_V1@1.0.0` is the single versioned OBS-010 authority on top of OBS-001 privacy-safe telemetry.

SLI v1:

- `AVAILABILITY` — 995000 ppm objective;
- `LATENCY` — 950000 ppm objective, 2000 ms threshold;
- `CORRECTNESS` — zero-tolerance 1000000 ppm objective;
- `FRESHNESS` — 990000 ppm objective, 900000 ms technical-age threshold;
- `MIGRATION_ERRORS` — zero-tolerance 1000000 ppm objective.

Ratios/budget burn use deterministic integer ppm/bps. Evaluation windows are half-open `[start_ms,end_ms)` with explicit integer timestamps. The evaluator does not read wall clock and has no `SpreadsheetApp`, DOM, network, external monitoring provider or financial-write authority.

Observation shapes are per-SLI and deny-by-default. Unknown fields fail closed. `CORRECTNESS` requires an allowlisted machine-evidence source: `FINANCIAL_RECONCILIATION`, `CANONICAL_SCHEMA`, `ANALYTICS_PARITY`, `MIGRATION_RECONCILIATION`, or `RUNTIME_HEALTH`. It never accepts or recomputes financial values.

Budget states are `HEALTHY`, `WATCH`, `CRITICAL`, `BREACHED`; insufficient or unavailable telemetry is `UNKNOWN`, never implicit green. Zero-tolerance correctness/migration SLI breach on any confirmed bad observation.

Public SLO evidence is technical metadata only: SLI/status/objective ppm/threshold ms/sample counts/budget ppm+bps/state/reason. Real or real-derived amounts, descriptions, categories, accounts, transactions and raw payload stay forbidden. `toAuditMetadata()` maps only bounded technical fields into the existing `SecurityPrivacyPolicy.js` allowlist and does not emit raw observations or correctness source.

Named machine gate: `SLO error budget` -> `tests/slo_error_budget_policy_contract_test.js`; full layered suite must also run the same contract test. No paid provider is required; `FREE_ONLY` remains mandatory.

Normative runbook: `docs/operations/OBS010_SLO_ERROR_BUDGET.md`.

## TEST-010 verified layered testing boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` versioned test taxonomy separates:

- `PURE_DOMAIN_APPLICATION`;
- `MIGRATION_RECOVERY`;
- `ADAPTER_INTEGRATION`;
- `RUNTIME_INTEGRATION`;
- `UI_E2E`;
- `POLICY_GOVERNANCE`.

Inventory scans tracked `tests/*_test.js` deterministically. Unclassified or ambiguous tests fail closed; layer file budgets are versioned. `pure` suite is an explicit subset and rejects platform-service source tokens. `full` suite remains the ordinary PR contract authority and runs every tracked test in stable path order.

Structured contract parsers replace lifecycle-critical source regex authority: `docs/PROJECT_STATUS.md` entries and named workflow steps are parsed structurally. Current writer assertions are branch-derived rather than hard-coded to a completed successor ID.

TEST-010 does not change FIN-TRUTH, KPI, Canonical Transaction, migration or analytics semantics and has no financial-write authority. Public tests remain independently generated synthetic only; no paid service/API dependency is introduced.

Normative runbook: `docs/operations/TEST010_LAYERED_TEST_ARCHITECTURE.md`.

## ANL-010 verified analytics boundary

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` defines `PRH_ANALYTICS_QUERY_V1` and `PRH_ANALYTICS_RESULT_V1`. Supported measures delegate to FIN-010 `evaluateKpis()` rather than duplicating financial formulas. Renderer/storage neutrality and `financial_write=false` remain invariant.

## MIG-010 historical verified boundary

`PRH_FULL_HISTORY_MIGRATION_V1`, `MIG010_REPAIR_POLICY_V1@1.1.0`, `CONTENT_FINGERPRINT_OCCURRENCE_V1`, `MIG010_EXECUTION_POLICY_V1@1.0.0` and adaptive typed staging remain historical contracts.

Owner-private execution was exact-authorized and verified by fresh encrypted post-write reconciliation:

- `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`;
- `unexplainedMismatch=0`;
- `provenanceComplete=true`;
- `idempotentRerunNoop=true`;
- `rollbackCanBeReleased=true`.

This one-time evidence does not grant continuing generic write authority. Hidden staging/rollback cleanup was not automatic. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; merge/AI cannot transfer owner authorization to later mutations.

## Current delivery

```text
Roadmap Issue IN_PROGRESS
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health + Web App render smoke v2
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE/closed
```

OBS-010 remains IN_PROGRESS until its behavioral/docs/machine evidence is green, PR is ready, exact-head trusted gates pass and Main Verification closes Issue #103.

## Executable continuation protocol

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` select/continue exactly one dependency-ready writer. Multiple writers, missing dependencies or private context fail closed.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers always `READ_ONLY`, `writer_authority: false`; P0/P1 block review evidence, P2/P3 advisory. Review does not override machine gates/Main Verification.

## Privacy / financial / cost boundaries

Real or real-derived household finance data stays private. Public finance fixtures are independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys and migration owner-private artifacts stay private. `FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`, integer minor units, posted-only, transfer-neutral, refund as expense reduction, mixed-currency fail-closed.

DATA-010: `PRH_CANONICAL_TRANSACTION_V1`; `source_position` mutable locator, not identity. Owner-confirmed identical operations may use `CONTENT_FINGERPRINT_OCCURRENCE_V1` without modifying financial fields for uniqueness.

ARCH-010: `PRH_APPLICATION_CORE_V1`; `io_authority=false`, `financial_write_authority=false`, `network_authority=false`.

ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation remains blocked.

ANL-010: `PRH_ANALYTICS_CONTRACT_V1`; pure query/evaluation boundary, renderer/storage-neutral, `financial_write=false`.

TEST-010: `PRH_TEST_ARCHITECTURE_V1`; test execution/classification authority only, no product/business/write authority.

OBS-010: `PRH_SLO_ERROR_BUDGET_V1`; technical SLI/error-budget authority only, no financial truth/write authority.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Issue #103
4. `/docs/PROJECT_STATUS.md`
5. `/docs/operations/OBS010_SLO_ERROR_BUDGET.md`
6. `/lib/observability/slo_error_budget.v1.json`
7. `/lib/observability/slo_error_budget.js`
8. `/tests/slo_error_budget_policy_contract_test.js`
9. `/SecurityPrivacyPolicy.js`
10. `/docs/operations/TEST010_LAYERED_TEST_ARCHITECTURE.md`
11. exact candidate code/tests/workflows

## Scope handoff

`AIENG-001/002/003`, `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010` = DONE. `OBS-010` = current R1 writer. Other R1 items remain dependency/priority-gated until its Main Verification.
