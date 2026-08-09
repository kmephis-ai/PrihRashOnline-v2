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
- `OBS-010` — DONE, Issue #103 Main Verification PASS.
- `PERF-010` — **current P1 writer**, Issue #105, branch `agent/PERF-010-query-projection-minimal-ranges`.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository port. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## PERF-010 query projection/minimal-range boundary

`PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` optimizes the current ARCH-011 Google Sheets adapter without changing repository/canonical/financial semantics.

Read model:

- one complete header row may be read for control-plane column discovery;
- data-plane rows are read only through requested mapped contiguous column spans and bounded row intervals;
- `readAll()` / `getRevision()` read all canonical-required mapped headers but omit unmapped worksheet columns;
- `getById()` scans only `ID`, then reads the full mapped projection for the unique matching source row;
- `query()` scans only `ID`, `Дата и время`, and source headers needed by active filters, applies normalized query matching/order, then reads full mapped headers only for selected page row groups;
- selected row numbers are grouped into contiguous intervals before full-row readback.

`normalizeQuery()` and repository result shape remain authoritative; PERF-010 does not define financial/business semantics. Synthetic parity tests compare projected Google query results with `applyQuery()` on the same canonical set.

`GoogleTransactionRepositoryGateway.js` v1.1.0 accepts strict `required_headers`, optional `start_row` and `row_count`. Unknown request/header fails closed. It does not use `getDataRange()` on the PERF-010 canonical path and has no financial-write authority. `writeBatch()` remains blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Public read instrumentation is technical only: projection ID, requested header count, projected column count, span count, row count, range read count and cell read count. It contains no amount, description, category, account/member/project value or transaction payload.

Current deterministic synthetic fixture evidence: source width 20 columns; mapped canonical width 15; old full-width baseline 80 data cells for four rows; projected `readAll=60`, `getById=19`, narrow type/status/category query `=35`. This is synthetic performance evidence only, not production finance telemetry.

Named machine gate: `Query projection minimal ranges` -> `tests/repository_projection_adapter_contract_test.js`; full TEST-010 layered suite also owns the test under `ADAPTER_INTEGRATION`.

Normative runbook: `docs/operations/PERF010_QUERY_PROJECTION.md`.

## OBS-010 verified SLO/error-budget boundary

`PRH_SLO_ERROR_BUDGET_V1@1.0.0` is the single versioned OBS-010 authority on top of OBS-001 privacy-safe telemetry. It uses deterministic integer ppm/bps, half-open windows and SLI `AVAILABILITY`, `LATENCY`, zero-tolerance `CORRECTNESS`, `FRESHNESS`, zero-tolerance `MIGRATION_ERRORS`.

Observation shapes are deny-by-default. `CORRECTNESS` accepts allowlisted machine evidence only and never recomputes financial values. Public SLO evidence is bounded technical metadata only. No paid provider is required; `FREE_ONLY`, `financial_write=false`, `financial_correctness=false`.

Normative runbook: `docs/operations/OBS010_SLO_ERROR_BUDGET.md`.

## TEST-010 verified layered testing boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` versioned test taxonomy separates `PURE_DOMAIN_APPLICATION`, `MIGRATION_RECOVERY`, `ADAPTER_INTEGRATION`, `RUNTIME_INTEGRATION`, `UI_E2E`, `POLICY_GOVERNANCE`.

Inventory scans tracked `tests/*_test.js` deterministically. Unclassified or ambiguous tests fail closed. `pure` suite rejects platform-service source tokens; `full` suite runs every tracked test in stable path order. Structured lifecycle/workflow parsers make current-writer assertions branch-derived rather than hard-coded to a completed successor ID.

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

This evidence does not grant continuing generic write authority. Hidden staging/rollback cleanup was not automatic. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; merge/AI cannot transfer owner authorization to later mutations.

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

PERF-010 remains IN_PROGRESS until its projection/parity/docs/machine evidence is green, PR is ready, exact-head trusted gates pass and Main Verification closes Issue #105.

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

ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation remains blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

ANL-010: `PRH_ANALYTICS_CONTRACT_V1`; pure query/evaluation boundary, renderer/storage-neutral, `financial_write=false`.

TEST-010: `PRH_TEST_ARCHITECTURE_V1`; test execution/classification authority only, no product/business/write authority.

OBS-010: `PRH_SLO_ERROR_BUDGET_V1`; technical SLI/error-budget authority only, no financial truth/write authority.

PERF-010: `PRH_GOOGLE_QUERY_PROJECTION_V1`; Google read-plan authority only, no financial/query/write authority.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Issue #105
4. `/docs/PROJECT_STATUS.md`
5. `/docs/operations/PERF010_QUERY_PROJECTION.md`
6. `/lib/adapters/google_sheets_projection.v1.json`
7. `/lib/adapters/google_sheets_projection.js`
8. `/lib/adapters/google_sheets_transaction_repository.js`
9. `/GoogleTransactionRepositoryGateway.js`
10. `/tests/repository_projection_adapter_contract_test.js`
11. `/docs/operations/OBS010_SLO_ERROR_BUDGET.md`
12. exact candidate code/tests/workflows

## Scope handoff

`AIENG-001/002/003`, `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010` = DONE. `PERF-010` = current R1 writer. Other R1 items remain dependency/priority-gated until its Main Verification.
