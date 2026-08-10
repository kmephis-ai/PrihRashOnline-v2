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
- `EXP-020` — **DONE**, Issue #126 Main Verification PASS, PR #127 merge `a3c938c08c3ae65a1f732aa024fa4001ca109883`.
- `INC-020` — **current R2 writer**, Issue #128, branch `agent/INC-020-income-analytics`; IN_PROGRESS до Main Verification.

## INC-020 Income Analytics boundary

Machine contract: `lib/income/income_analytics.v1.json` (`PRH_INCOME_ANALYTICS_V1@1.0.0`). Core: `lib/income/income_analytics.js`. Human contract: `docs/analytics/INCOME_ANALYTICS.md`. Browser evidence: `IncomeAnalyticsWebApp.html`. Tests: `tests/income_analytics_contract_test.js`, `tests/income_analytics_visual_test.js`. Named gates: `Income Analytics`, `Income Analytics visual gate`.

Rules:

- INC consumes FIN-010/ANL-010/VIZ-020/TX-020 and does not redefine their contracts.
- Primary/comparison `INCOME` totals are sourced from FIN-010 `evaluateKpis()`.
- Trend uses explicit bounded DAY/MONTH/YEAR windows; each bucket is evaluated by FIN-010 and bucket sum must equal period INCOME.
- MONTH trend requires first-day month boundaries; YEAR trend requires January-1 boundaries; ambiguous windows fail closed.
- Current source dimension is canonical income `category_id` (`CANONICAL_INCOME_CATEGORY_AS_SOURCE`) so TX drill can use exact `category_ids`, not fuzzy text search.
- Source mix groups canonical rows and evaluates each source through FIN-TRUTH `aggregateTransactions()`, so non-income rows do not become income by UI logic.
- Source partition sum must equal FIN-010 INCOME exactly; residual must be zero; negative source bucket is fail-closed for DONUT ambiguity.
- Comparison requires explicit equal-day windows through FIN-010 `assertComparablePeriods()`; implicit proration is forbidden.
- Stability/variance use only FIN-backed trend bucket totals: population variance, stddev, coefficient of variation, bounded 0–100 stability score. These are explanatory derived metrics, not financial truth.
- Source deltas are current source INCOME minus comparison source INCOME; exact sum must equal total INCOME delta.
- WidgetSpecs are configuration-only VIZ `LINE`, `DONUT`, `BAR`; real render rows/amounts are separate transient private runtime datasets.
- Drill uses deterministic `PRH_FILTER_CONTEXT_V1` / `PRH_DRILL_CONTEXT_V1` target `TRANSACTION_EXPLORER`, then bounded TX-020 query; navigation state contains no financial/variance values.
- Income Analytics has no storage/network/financial-write authority. TX save remains `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.
- Public telemetry/evidence contains only schema/version/query-hash/context-hash/bucket/source counts/stability-state/status/reason/timing metadata; real amounts/private IDs are forbidden.
- Public browser/tests use independently generated synthetic data only.
- `FREE_ONLY` mandatory; no external CDN/provider required.

Canonical INC-020 reading order:

1. `/docs/ROADMAP.md`
2. live Issue #128
3. `/docs/PROJECT_STATUS.md`
4. `/lib/income/income_analytics.v1.json`
5. `/lib/income/income_analytics.js`
6. `/docs/analytics/INCOME_ANALYTICS.md`
7. `/tests/income_analytics_contract_test.js`
8. `/IncomeAnalyticsWebApp.html`
9. `/tests/income_analytics_visual_test.js`
10. exact candidate workflows/evidence

CF-020/BUD-020/OBL-020/PWA-020 and other sibling scopes are not part of the current writer.

## Verified R2 upstream boundaries

`PRH_DESIGN_SYSTEM_V1@1.0.0` remains presentation-only; no financial/query/storage/write authority.  
`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` remains configuration/interaction/replaceable-renderer authority only; no financial/query/storage/write authority.  
`PRH_FINANCIAL_HOME_V1@1.0.0` remains FIN-backed Home composition only.  
`PRH_TRANSACTION_EXPLORER_V1@1.0.0` remains canonical exploration/edit-draft validation only; `financial_write=false`.  
`PRH_EXPENSE_ANALYTICS_V1@1.0.0` remains FIN-backed Expense analysis/read model only; `financial_write=false`.

## DOC-010 verified documentation boundary

`PRH_R1_DOCUMENTATION_V1@1.0.0` is DONE/Main Verification PASS. Canonical R1 maps remain `docs/architecture/R1_C4_CONTEXT.md`, `docs/data/R1_DATA_LINEAGE.md`, `lib/documentation/r1_documentation.v1.json`, `tests/r1_documentation_contract_test.js`. Documentation cannot override Roadmap/live Issues/exact-SHA gates.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. INC core contract is `PURE_DOMAIN_APPLICATION`; INC browser visual test is `UI_E2E`. Unknown/ambiguous test classification fails.

## ANL / FIN / PERF authority

`FIN-TRUTH-v1` / `PRH_KPI_DICTIONARY_V1` owns financial semantics. `PRH_ANALYTICS_CONTRACT_V1@1.0.0` remains renderer/storage-neutral and delegates KPI semantics to FIN-010; `financial_write=false`. PERF-010..014 optimize reads/reuse/recompute only. INC-020 composes FIN-backed read models and never becomes financial truth authority.

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

INC-020 remains open until FIN/source/stability/drill contracts, full layered suite and visual evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #128.

## Executable continuation protocol

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` select exactly one dependency-ready writer. Multiple writers/missing dependencies/private context fail closed.

## Read-only multi-AI review

Required roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority:false`; unresolved P0/P1 blocks supplementary review evidence. Review cannot override red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Public finance/render/INC fixtures are independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys, migration artifacts, real Analytics/Home/TX/EXP/INC models and renderer options stay private. Family Web App remains private `MYSELF`. `FREE_ONLY` remains mandatory.

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
EXP-020: `PRH_EXPENSE_ANALYTICS_V1`; FIN-backed expense analysis/read model only.  
INC-020: `PRH_INCOME_ANALYTICS_V1`; FIN-backed income source/trend/stability read model only; `financial_write=false`.

## Scope handoff

All R1 items plus DESIGN-020/VIZ-020/HOME-020/TX-020/EXP-020 are DONE. `MASTER-G3 = complete`. `INC-020` is the single current R2 writer.
