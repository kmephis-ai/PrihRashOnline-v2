# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys и owner-private payload запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **каноническая Executable GitHub Roadmap v2.3**.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

Chat history/memory и stale Roadmap copies not authority.

## Verified R0/R1 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2`, `MASTER-G3` — complete. `AIENG-001`, `AIENG-002`, `AIENG-003` — DONE.

R1 DONE/Main Verification PASS: `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`.

`DOC-010` — **DONE**, Main Verification PASS; `PRH_R1_DOCUMENTATION_V1@1.0.0` remains the verified R1 documentation-coherence authority.

Private MIG-010 full-history reconciliation = PASS. Independently generated synthetic 20k/50k performance = PASS.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS.
- `HOME-020` — **DONE**, Issue #122 Main Verification PASS.
- `TX-020` — **DONE**, Issue #124 Main Verification PASS, PR #125 merge `38a6d6bece459f61a2cf3d9af2cd8419274b258b`.
- `EXP-020` — **current R2 writer**, Issue #126, branch `agent/EXP-020-expense-analytics`; IN_PROGRESS до Main Verification.

## EXP-020 Expense Analytics boundary

Machine contract: `lib/expense/expense_analytics.v1.json` (`PRH_EXPENSE_ANALYTICS_V1@1.0.0`). Core: `lib/expense/expense_analytics.js`. Human contract: `docs/analytics/EXPENSE_ANALYTICS.md`. Browser evidence: `ExpenseAnalyticsWebApp.html`. Tests: `tests/expense_analytics_contract_test.js`, `tests/expense_analytics_visual_test.js`. Named gates: `Expense Analytics`, `Expense Analytics visual gate`.

Rules:

- EXP consumes FIN-010/ANL-010/VIZ-020/TX-020 and does not redefine their contracts.
- Primary and comparison `EXPENSE` totals are sourced from FIN-010 `evaluateKpis()`.
- Trend is explicit bounded DAY/MONTH/YEAR windows; every bucket is evaluated by FIN-010 and bucket sum must equal period EXPENSE.
- MONTH trend requires month-boundary alignment; YEAR trend requires January-1 alignment; ambiguous windows fail closed.
- Category mix uses FIN-TRUTH `aggregateTransactions()` / `by_expense_category_minor`: expense adds, refund reduces, transfer is neutral.
- Category partition sum must equal FIN-010 EXPENSE exactly; residual must be zero. Negative category bucket is fail-closed for DONUT ambiguity.
- Comparison requires explicit equal-day windows through FIN-010 `assertComparablePeriods()`; implicit proration is forbidden.
- Drivers are current category expense minus comparison category expense; their exact sum must equal total EXPENSE delta.
- WidgetSpecs are configuration-only VIZ `LINE`, `DONUT`, `BAR`; financial render rows/amounts are separate transient runtime datasets.
- Drill uses deterministic `PRH_FILTER_CONTEXT_V1` / `PRH_DRILL_CONTEXT_V1` target `TRANSACTION_EXPLORER`, then bounded TX-020 query; navigation state contains no financial values.
- Expense Analytics has no storage/network/financial-write authority. TX save remains `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.
- Public telemetry/evidence contains only schema/version/query-hash/context-hash/bucket/category/driver counts/status/reason/timing metadata; real amounts/private IDs are forbidden.
- Public browser/tests use independently generated synthetic data only.
- `FREE_ONLY` mandatory; no external CDN/provider required.

Canonical EXP-020 reading order:

1. `/docs/ROADMAP.md`
2. live Issue #126
3. `/docs/PROJECT_STATUS.md`
4. `/lib/expense/expense_analytics.v1.json`
5. `/lib/expense/expense_analytics.js`
6. `/docs/analytics/EXPENSE_ANALYTICS.md`
7. `/tests/expense_analytics_contract_test.js`
8. `/ExpenseAnalyticsWebApp.html`
9. `/tests/expense_analytics_visual_test.js`
10. exact candidate workflows/evidence

INC-020/CF-020/BUD-020/PWA-020 and other sibling scopes are not part of the current writer.

## Verified R2 upstream boundaries

`PRH_DESIGN_SYSTEM_V1@1.0.0` remains presentation-only; no financial/query/storage/write authority.  
`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` remains configuration/interaction/replaceable-renderer authority only; no financial/query/storage/write authority.  
`PRH_FINANCIAL_HOME_V1@1.0.0` remains FIN-backed Home composition only.  
`PRH_TRANSACTION_EXPLORER_V1@1.0.0` remains canonical exploration/edit-draft validation only; `financial_write=false`.

## DOC-010 verified documentation boundary

`PRH_R1_DOCUMENTATION_V1@1.0.0` is DONE/Main Verification PASS. Canonical R1 maps remain `docs/architecture/R1_C4_CONTEXT.md`, `docs/data/R1_DATA_LINEAGE.md`, `lib/documentation/r1_documentation.v1.json`, `tests/r1_documentation_contract_test.js`. Documentation cannot override Roadmap/live Issues/exact-SHA gates.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. EXP core contract is `PURE_DOMAIN_APPLICATION`; EXP browser visual test is `UI_E2E`. Unknown/ambiguous test classification fails.

## ANL / FIN / PERF authority

`FIN-TRUTH-v1` / `PRH_KPI_DICTIONARY_V1` owns financial semantics. `PRH_ANALYTICS_CONTRACT_V1@1.0.0` remains renderer/storage-neutral and delegates KPI semantics to FIN-010; `financial_write=false`. PERF-010..014 optimize reads/reuse/recompute only. EXP-020 composes FIN-backed read models and never becomes financial truth authority.

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

EXP-020 remains open until FIN/category/driver/drill contracts, full layered suite and visual evidence are green, trusted exact-head deploy/runtime health passes and Main Verification closes Issue #126.

## Executable continuation / review

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` select exactly one dependency-ready writer. Multiple writers/missing dependencies/private context fail closed.

Read-only multi-AI roles remain `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`; reviewers are `READ_ONLY`, `writer_authority:false`. Review cannot override red machine gates or Main Verification.

## Privacy / runtime / cost

Real or real-derived household finance data stays private. Public finance/render/EXP fixtures are independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys, migration artifacts, real Analytics/Home/TX/EXP models and renderer options stay private. Family Web App remains private `MYSELF`. `FREE_ONLY` remains mandatory.

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
EXP-020: `PRH_EXPENSE_ANALYTICS_V1`; FIN-backed expense analysis/read model only; `financial_write=false`.

## Scope handoff

All R1 items plus DESIGN-020/VIZ-020/HOME-020/TX-020 are DONE. `MASTER-G3 = complete`. `EXP-020` is the single current R2 writer.
