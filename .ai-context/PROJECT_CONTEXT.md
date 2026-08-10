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

- `FIN-010` — DONE, Issue #85 Main Verification PASS.
- `DATA-010` — DONE, Issue #87 Main Verification PASS.
- `ARCH-010` — DONE, Issue #89 Main Verification PASS.
- `ARCH-011` — DONE, Issue #91 Main Verification PASS.
- `MIG-010` — DONE, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — DONE, Issue #98 Main Verification PASS.
- `TEST-010` — DONE, Issue #100 Main Verification PASS.
- `OBS-010` — DONE, Issue #103 Main Verification PASS.
- `PERF-010` — DONE, Issue #105 Main Verification PASS.
- `PERF-011` — DONE, Issue #108 Main Verification PASS.
- `PERF-012` — DONE, Issue #110 Main Verification PASS.
- `PERF-013` — DONE, Issue #112 Main Verification PASS.
- `PERF-014` — DONE, Issue #114 Main Verification PASS.
- `DOC-010` — DONE, Issue #116 Main Verification PASS.

`MASTER-G3 / Canonical platform` — **complete**. Private full-history reconciliation = PASS; independently generated synthetic 20k/50k performance = PASS.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS, PR #119 autonomous merge `9337dfb1288ebc3e0c746ab744b61bb1051e14ea`.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS, PR #121 autonomous merge `66139972b1fc910fc7bc0e614ecfdc7d5b754adf`.
- `HOME-020` — **current R2 writer**, Issue #122, branch `agent/HOME-020-financial-home`; remains open until Main Verification.

`PRH_DESIGN_SYSTEM_V1@1.0.0` remains presentation-only: semantic tokens, explicit light/dark theme, focus/reduced-motion and responsive shell; no financial/query/storage/write authority and no paid/external design provider requirement.

`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` remains renderer-neutral: configuration-only `PRH_CHART_SPEC_V1` / `PRH_WIDGET_SPEC_V1`, `BAR|LINE|DONUT` registry, deterministic `PRH_FILTER_CONTEXT_V1` / `PRH_DRILL_CONTEXT_V1`, transient render dataset and replaceable `ECHARTS_6` adapter. Specs contain no financial payload; real render data/options remain private runtime-only. No query/network/storage/persistence/financial-write authority. `FREE_ONLY` mandatory.

## HOME-020 Financial Home boundary

Machine contract: `lib/home/financial_home.v1.json` (`PRH_FINANCIAL_HOME_V1@1.0.0`). View model: `PRH_FINANCIAL_HOME_VIEW_V1`. Implementation: `lib/home/financial_home.js`. Browser surface: `FinancialHomeWebApp.html`. Tests: `tests/financial_home_contract_test.js`, `tests/financial_home_visual_test.js`. Named gates: `Financial Home`, `Financial Home visual gate`.

Financial Home rules:

- Income / Expense / Cash Flow / Savings / Budget variance come from one FIN-010 `evaluateKpis()` evaluation; Home/UI do not implement alternative KPI formulas.
- Budget is valid only with explicit same-period/same-currency `budget_minor`; missing plan -> `NOT_CONFIGURED`, never inferred from history.
- Liquidity has no canonical value until a versioned balance-observation source exists. Current state -> `UNAVAILABLE_PENDING_BALANCE_SOURCE`; cash flow proxy is forbidden; future dependency `BAL-030`.
- Alerts are explainable/versioned conditions over already-evaluated FIN outputs or explicit capability states: `NEGATIVE_CASH_FLOW`, `BUDGET_OVERRUN`, `BUDGET_NOT_CONFIGURED`, `LIQUIDITY_SOURCE_UNAVAILABLE`.
- Drill navigation is `PRH_HOME_DRILL_ENVELOPE_V1` containing explicit FIN period + VIZ `PRH_DRILL_CONTEXT_V1`; financial values are not embedded in navigation state/URL.
- Home WidgetSpecs are configuration-only and use VIZ semantic encodings; real Home view/render payload remains private.
- Public Home fixture/visual evidence is independently generated synthetic only.
- HOME-020 has no financial truth/query/storage/network/financial-write/balance-observation authority.
- External CDN/paid dependency not required; `FREE_ONLY` mandatory.

Canonical HOME-020 entry points:

1. `docs/ROADMAP.md`
2. live Issue #122
3. `docs/PROJECT_STATUS.md`
4. `lib/home/financial_home.v1.json`
5. `lib/home/financial_home.js`
6. `FinancialHomeWebApp.html`
7. `tests/financial_home_contract_test.js`
8. `tests/financial_home_visual_test.js`
9. exact candidate workflows/evidence

Dependent R2 work (`EXP-020`, `INC-020`, later dashboards) remains dependency-gated by the Roadmap; HOME-020 does not take those scopes.

## DOC-010 verified documentation-coherence boundary

`PRH_R1_DOCUMENTATION_V1@1.0.0` maps normative docs to versioned contracts/source/tests/named gates. DOC-010 is DONE/Main Verification PASS. Documentation cannot override Roadmap/live Issues/exact-SHA machine gates.

Canonical R1 maps remain `docs/architecture/R1_C4_CONTEXT.md`, `docs/data/R1_DATA_LINEAGE.md`, `lib/documentation/r1_documentation.v1.json`, `tests/r1_documentation_contract_test.js`.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies every tracked test fail-closed. DESIGN-020/VIZ-020/HOME-020 contracts are `UI_E2E`; Financial Home visual test is also `UI_E2E`. Unknown/ambiguous test classification fails.

## ANL / FIN / PERF authority

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` remains renderer/storage-neutral and delegates KPI semantics to FIN-010. PERF-010..014 optimize reads/reuse/recompute but cannot redefine financial truth. HOME-020 consumes FIN results and VIZ configuration; it does not become a second analytics or finance authority.

## MIG-010 historical verified boundary

Owner-private migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound and is non-reusable. GitHub Actions/AI cannot create or reuse it for future mutations. Generic financial write remains blocked.

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

HOME-020 remains open until its contract/visual/full suites are green, trusted exact-head deploy/runtime evidence passes and Main Verification closes Issue #122.

## Executable continuation protocol

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` select exactly one dependency-ready writer. Multiple writers, missing dependencies or private context fail closed.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers are `READ_ONLY`, `writer_authority:false`; unresolved P0/P1 blocks supplementary review evidence. Review never overrides machine gates/Main Verification.

## Privacy / financial / cost boundaries

Real or real-derived household finance data stays private. Public finance/render fixtures are independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys, migration artifacts, real Home view models and renderer options stay private. `FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`.  
DATA-010: `PRH_CANONICAL_TRANSACTION_V1`.  
ARCH-010: `PRH_APPLICATION_CORE_V1`; no I/O/network/financial-write authority.  
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation blocked.  
ANL-010: `PRH_ANALYTICS_CONTRACT_V1`; no financial-write authority.  
TEST-010: `PRH_TEST_ARCHITECTURE_V1`; test authority only.  
OBS-010: `PRH_SLO_ERROR_BUDGET_V1`; technical SLO authority only.  
PERF-010..014: read/performance authority only.  
DOC-010: `PRH_R1_DOCUMENTATION_V1`; documentation coherence only.  
DESIGN-020: `PRH_DESIGN_SYSTEM_V1`; presentation semantics only.  
VIZ-020: `PRH_VISUALIZATION_FOUNDATION_V1`; visualization configuration/interaction/renderer-adapter only.  
HOME-020: `PRH_FINANCIAL_HOME_V1`; FIN-backed view composition + explainable Home alert/drill policy only.

## Scope handoff

`AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`; all R1 items, `DESIGN-020`, `VIZ-020` = DONE. `MASTER-G3 = complete`. `HOME-020` is the single current R2 writer.