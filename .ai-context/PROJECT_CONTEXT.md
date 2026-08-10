# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys и owner-private payload запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **каноническая Executable GitHub Roadmap v2.3**.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

Chat history/memory и stale Roadmap copies not authority.

## Current R0 truth

R0 machine-proven complete. `MASTER-G0`, `MASTER-G1`, `MASTER-G2` закрыты. `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

## Current R1 truth

`MASTER-G3 / Canonical platform` — complete. Independently generated synthetic 20k/50k performance = PASS.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS.
- `TEST-010` — **DONE**, Issue #100 Main Verification PASS.
- `OBS-010` — **DONE**, Issue #103 Main Verification PASS.
- `PERF-010` — **DONE**, Issue #105 Main Verification PASS.
- `PERF-011` — **DONE**, Issue #108 Main Verification PASS.
- `PERF-012` — **DONE**, Issue #110 Main Verification PASS.
- `PERF-013` — **DONE**, Issue #112 Main Verification PASS.
- `PERF-014` — **DONE**, Issue #114 Main Verification PASS.
- `DOC-010` — **DONE**, Issue #116 Main Verification PASS; `PRH_R1_DOCUMENTATION_V1@1.0.0` verified.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS.
- `HOME-020` — **DONE**, Issue #122 Main Verification PASS.
- `TX-020` — **DONE**, Issue #124 Main Verification PASS.
- `EXP-020` — **DONE**, Issue #126 Main Verification PASS.
- `INC-020` — **DONE**, Issue #128 Main Verification PASS, PR #129 merge `507e2cd32f28104b1a81bc02aa7856be41be58b2`.
- `CF-020` — **current R2 writer**, Issue #130, branch `agent/CF-020-cash-flow-dashboard`; IN_PROGRESS до Main Verification.

## CF-020 Cash Flow boundary

Machine contract: `lib/cashflow/cash_flow_dashboard.v1.json` (`PRH_CASH_FLOW_DASHBOARD_V1@1.0.0`). Core: `lib/cashflow/cash_flow_dashboard.js`. Human contract: `docs/analytics/CASH_FLOW_DASHBOARD.md`. Browser evidence: `CashFlowWebApp.html`. Tests: `tests/cash_flow_dashboard_contract_test.js`, `tests/cash_flow_visual_test.js`. Named gates: `Cash Flow`, `Cash Flow visual gate`.

Rules:

- CF consumes FIN-010/HOME-020/VIZ-020/TX-020 and does not redefine them.
- Inflow = FIN-010 `INCOME`, outflow = FIN-010 `EXPENSE`, net = FIN-010 `CASH_FLOW`.
- Period, comparison and every trend bucket must satisfy `inflow - outflow = net`.
- Trend uses explicit bounded DAY/MONTH/YEAR windows, each evaluated by FIN-010; bucket sums must exactly equal period totals.
- Transfers are neutral and excluded from INFLOW/OUTFLOW/NET component drill filters. Refund affects outflow only through FIN-010 Expense semantics.
- Comparison requires explicit equal-day windows through FIN-010 `assertComparablePeriods()`; implicit proration is forbidden.
- Comparison deltas must satisfy `inflow_delta - outflow_delta = net_delta`.
- VIZ specs are configuration-only: net LINE, inflow BAR, outflow BAR, comparison BAR. Real render rows remain private transient runtime datasets.
- Drill uses `PRH_FILTER_CONTEXT_V1` / `PRH_DRILL_CONTEXT_V1` target `TRANSACTION_EXPLORER`, then bounded TX query: INFLOW `income`; OUTFLOW `expense/refund`; NET `income/expense/refund`; transfer never included.
- Navigation state contains no financial or balance values and grants no write authority.
- `liquidity_state = NOT_A_BALANCE_METRIC`; `account_balance_authority=false`. Cash Flow is not balance/liquidity/Net Worth truth and cannot proxy Home liquidity.
- CF has no storage/network/financial-write authority. TX save remains `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.
- Public telemetry/evidence contains only schema/version/query/context hashes/bucket counts/status/reason/timing metadata; real amounts/private IDs are forbidden.
- Public browser/tests use independently generated synthetic data only.
- `FREE_ONLY` mandatory; no external CDN/provider required.

Canonical CF-020 reading order:

1. `/docs/ROADMAP.md`
2. live Issue #130
3. `/docs/PROJECT_STATUS.md`
4. `/lib/cashflow/cash_flow_dashboard.v1.json`
5. `/lib/cashflow/cash_flow_dashboard.js`
6. `/docs/analytics/CASH_FLOW_DASHBOARD.md`
7. `/tests/cash_flow_dashboard_contract_test.js`
8. `/CashFlowWebApp.html`
9. `/tests/cash_flow_visual_test.js`
10. exact candidate workflows/evidence

BUD-020/OBL-020/PWA-020 and sibling scopes are not part of current writer.

## Verified R2 upstream boundaries

`PRH_DESIGN_SYSTEM_V1@1.0.0` remains presentation-only.  
`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` remains configuration/interaction/replaceable-renderer only.  
`PRH_FINANCIAL_HOME_V1@1.0.0` remains FIN-backed Home composition; Cash Flow proxy for liquidity is forbidden.  
`PRH_TRANSACTION_EXPLORER_V1@1.0.0` remains canonical exploration/edit-draft validation only; `financial_write=false`.  
`PRH_EXPENSE_ANALYTICS_V1@1.0.0` remains FIN-backed Expense read model only.  
`PRH_INCOME_ANALYTICS_V1@1.0.0` remains FIN-backed Income read model only.

## DOC-010 verified documentation boundary

`PRH_R1_DOCUMENTATION_V1@1.0.0` is DONE/Main Verification PASS. Canonical R1 maps remain `docs/architecture/R1_C4_CONTEXT.md`, `docs/data/R1_DATA_LINEAGE.md`, `lib/documentation/r1_documentation.v1.json`, `tests/r1_documentation_contract_test.js`. Documentation cannot override Roadmap/live Issues/exact-SHA gates.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. CF core contract is `PURE_DOMAIN_APPLICATION`; CF browser visual test is `UI_E2E`. Unknown/ambiguous test classification fails.

## ANL / FIN / PERF authority

`FIN-TRUTH-v1` / `PRH_KPI_DICTIONARY_V1` owns financial semantics. `PRH_ANALYTICS_CONTRACT_V1@1.0.0` remains renderer/storage-neutral and delegates KPI semantics to FIN-010; `financial_write=false`. PERF-010..014 optimize reads/reuse/recompute only. CF-020 composes FIN-backed read models and never becomes financial truth or balance authority.

## MIG-010 historical verified boundary

Owner-private migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

Authorized execution was governed by `MIG010_EXECUTION_POLICY_V1@1.0.0`; finalize could enter `FINALIZED_PENDING_RECONCILIATION` and was not considered complete until post-write reconciliation reached PASS/OWNER_VERIFIED.

Historical authorization is exact-bound and non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Generic Google financial write remains blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Historical executable references remain:

- `docs/adr/ADR-MIG-010-OCCURRENCE-IDENTITY.md`
- `docs/adr/ADR-MIG-010-PROPOSAL-COMPATIBILITY.md`
- `docs/operations/MIG010_FULL_HISTORY_MIGRATION.md`
- `docs/operations/MIG010_REPAIR_POLICY.md`
- `docs/operations/MIG010_AUTHORIZED_EXECUTION.md`
- `lib/migration/full_history_migration.v1.json`
- `lib/migration/full_history_migration.js`
- `lib/migration/mig010_repair_policy.v1.json`
- `lib/migration/mig010_repair_policy.js`
- `lib/migration/mig010_execution_policy.v1.json`
- `Mig010ExecutionGateway.js`
- `Mig010ExecutionTypedWrite.js`
- `tools/mig010-owner.js`
- `tools/mig010-repair.js`
- `tools/mig010-rebuild-dry-run.js`
- `tools/mig010-execution-package.js`
- `tools/mig010-authorized-executor.js`
- `tools/mig010-post-reconcile.js`
- `tests/full_history_migration_contract_test.js`
- `tests/mig010_occurrence_identity_contract_test.js`
- `tests/mig010_owner_tool_contract_test.js`
- `tests/mig010_owner_diagnostics_contract_test.js`
- `tests/mig010_repair_policy_contract_test.js`
- `tests/mig010_repair_policy_compatibility_contract_test.js`
- `tests/mig010_repair_tool_contract_test.js`
- `tests/mig010_rebuild_dry_run_contract_test.js`
- `tests/mig010_execution_package_contract_test.js`
- `tests/mig010_execution_gateway_contract_test.js`
- `tests/mig010_authorized_executor_contract_test.js`
- `tests/mig010_typed_staging_write_contract_test.js`
- `tests/mig010_post_reconcile_contract_test.js`
- `tests/mig010_documentation_contract_test.js`
- `tests/mig010_execution_documentation_contract_test.js`

## Current delivery

```text
Roadmap Issue
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health + Web App render smoke v2
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE/closed
```

CF-020 remains open until FIN/transfer/comparison/drill contracts, full layered suite and visual evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #130.

## Executable continuation protocol

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` select exactly one dependency-ready writer. Multiple writers/missing dependencies/private context fail closed.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority:false`; unresolved P0/P1 blocks supplementary review evidence. Review cannot override red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Public finance/render/CF fixtures are independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys, migration artifacts, real Analytics/Home/TX/EXP/INC/CF models and renderer options stay private. Family Web App remains private `MYSELF`. `FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`.  
DATA-010: `PRH_CANONICAL_TRANSACTION_V1`.  
ARCH-010: `PRH_APPLICATION_CORE_V1`; no I/O/network/financial-write authority.  
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation blocked.  
ANL-010: `PRH_ANALYTICS_CONTRACT_V1`; `financial_write=false`.  
TEST-010: `PRH_TEST_ARCHITECTURE_V1`; test authority only.  
OBS-010: `PRH_SLO_ERROR_BUDGET_V1`; technical SLO authority only.  
PERF-010..014: read/performance authority only.  
DOC-010: `PRH_R1_DOCUMENTATION_V1`; documentation coherence only.  
DESIGN-020: `PRH_DESIGN_SYSTEM_V1`; presentation only.  
VIZ-020: `PRH_VISUALIZATION_FOUNDATION_V1`; visualization config/interaction/renderer adapter only.  
HOME-020: `PRH_FINANCIAL_HOME_V1`; FIN-backed view composition only.  
TX-020: `PRH_TRANSACTION_EXPLORER_V1`; canonical exploration/edit draft only.  
EXP-020: `PRH_EXPENSE_ANALYTICS_V1`; FIN-backed expense read model only.  
INC-020: `PRH_INCOME_ANALYTICS_V1`; FIN-backed income read model only.  
CF-020: `PRH_CASH_FLOW_DASHBOARD_V1`; FIN-backed transfer-neutral cash-flow read model only; `financial_write=false`, `liquidity=false`, `account_balance=false`.

## Scope handoff

All R1 items plus DESIGN-020/VIZ-020/HOME-020/TX-020/EXP-020/INC-020 are DONE. `MASTER-G3 = complete`. `CF-020` is the single current R2 writer.
