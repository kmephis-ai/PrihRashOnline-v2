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

- `FIN-010` — DONE.
- `DATA-010` — DONE.
- `ARCH-010` — DONE, Issue #89 Main Verification PASS.
- `ARCH-011` — DONE, Issue #91 Main Verification PASS.
- `MIG-010` — DONE, Issue #96 Main Verification PASS; private `OWNER_VERIFIED` evidence retained historically.
- `ANL-010` — DONE, Issue #98 Main Verification PASS.
- `TEST-010` — DONE, Issue #100 Main Verification PASS.
- `OBS-010` — DONE, Issue #103 Main Verification PASS.
- `PERF-010` — DONE, Issue #105 Main Verification PASS.
- `PERF-011` — DONE, Issue #108 Main Verification PASS.
- `PERF-012` — DONE, Issue #110 Main Verification PASS.
- `PERF-013` — DONE, Issue #112 Main Verification PASS.
- `PERF-014` — DONE, Issue #114 Main Verification PASS.
- `DOC-010` — DONE, Issue #116 Main Verification PASS.

`MASTER-G3` — **complete**: все обязательные R1 dependencies DONE, private full-history reconciliation PASS, synthetic 20k/50k performance PASS.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository authority. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Current R2 truth

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS, PR #119 autonomous merge `9337dfb1288ebc3e0c746ab744b61bb1051e14ea`.
- `VIZ-020` — **current R2 writer**, Issue #120, branch `agent/VIZ-020-visualization-foundation`, IN_PROGRESS до Main Verification.
- `HOME-020` и другие VIZ-dependent R2 items dependency-gated до VIZ-020 DONE.

`PRH_DESIGN_SYSTEM_V1@1.0.0` — presentation-only contract: semantic typography/spacing/radius/elevation/colors/focus/motion tokens, explicit light/dark `html[data-theme]`, system dark preference при отсутствии explicit theme, `:focus-visible`, `prefers-reduced-motion`, responsive breakpoints 760/1250 px. Он не имеет financial/query/storage/write authority, не содержит financial payload и не требует external CDN/font/design provider. `FREE_ONLY` сохраняется.

`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` — renderer-neutral visualization/interaction contract поверх DESIGN-020 + ANL-010. Он определяет configuration-only `PRH_CHART_SPEC_V1`, `PRH_WIDGET_SPEC_V1`, chart registry (`BAR`, `LINE`, `DONUT`), deterministic `PRH_FILTER_CONTEXT_V1` / `PRH_DRILL_CONTEXT_V1`, transient `PRH_VISUALIZATION_RENDER_DATASET_V1` и replaceable primary browser renderer `ECHARTS_6`.

VIZ-020 invariant: ChartSpec/WidgetSpec не содержат financial rows/data/amount payload. Runtime render dataset/compiled renderer option могут содержать private values только in-memory и не являются public evidence. Renderer не имеет query/network/storage/persistence/financial-write authority. External CDN/provider не требуется; loading policy `LOCAL_OR_BUNDLED`; `FREE_ONLY` mandatory.

Canonical VIZ-020 entry points:

- `docs/architecture/VISUALIZATION_FOUNDATION.md`;
- `docs/adr/ADR-VIZ-020-ECHARTS-6.md`;
- `lib/visualization/visualization_foundation.v1.json`;
- `lib/visualization/visualization_foundation.js`;
- `tests/visualization_foundation_contract_test.js`;
- named PR gate `Visualization foundation`.

Canonical DESIGN-020 entry points:

- `docs/design/DESIGN_SYSTEM.md`;
- `lib/design/design_system.v1.json`;
- `tests/design_system_contract_test.js`;
- `DashboardWebApp.html` — presentation consumer;
- named PR gate `Design system`.

## DOC-010 verified documentation-coherence boundary

`PRH_R1_DOCUMENTATION_V1@1.0.0` maps required human docs to versioned machine contracts, source files, contract tests and named PR Validation gates. DOC-010 завершён Main Verification; documentation остаётся descriptive/verifiable authority ниже Roadmap/live lifecycle/exact-SHA machine evidence и не может override red gate.

Canonical DOC-010 entry points:

- `docs/architecture/R1_C4_CONTEXT.md` — system/container C4 context, trust/mutation/cost/future-provider boundaries;
- `docs/data/R1_DATA_LINEAGE.md` — source → repository/canonical → FIN/KPI → analytics → PERF-010..014 → private UI, plus migration/recovery/SLO/delivery lineages;
- `lib/documentation/r1_documentation.v1.json` — machine documentation inventory;
- `tests/r1_documentation_contract_test.js` — path/link/named-gate/lifecycle/privacy/FREE_ONLY/write-boundary drift detector;
- named PR gate `R1 documentation contract`.

Private runtime locators, real/real-derived financial payload, OAuth, backup/private evidence remain forbidden. `FREE_ONLY` remains mandatory. Generic Google financial write remains blocked.

## PERF-014 verified scale boundary

`PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0` is DONE. Deterministic independently generated synthetic 20k/50k datasets prove canonical revision, ANL-010 full recompute, PERF-012 one-scan refresh, PERF-013 full/incremental aggregate parity, one canonical read per linked refresh and zero financial writes. Timings are CI regression guardrails, not production SLA.

## PERF-013 verified aggregate boundary

`PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0` is DONE. MONTH/CATEGORY_ID/ACCOUNT_ID materializations use FIN-010 formulas, exact canonical revision/state hash and deterministic affected-bucket delta with fresh full-build parity. Mixed currency fails closed; no write/provider authority.

## PERF-012 verified single-scan boundary

`PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` is DONE. One bounded refresh cycle materializes one validated canonical snapshot, derives exact content revision from that snapshot and serves linked repository/analytics consumers locally. No cross-cycle reuse or write authority.

## PERF-011 verified cache boundary

`PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` is DONE. Independent request cache HIT requires exact revision confirmation; stale/unknown revision fails closed and cache has no financial/write authority.

## PERF-010 verified projection boundary

`PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` is DONE. Header discovery is separated from data-plane reads; Google canonical rows are read only through required mapped contiguous spans/rows. Generic write stays blocked.

## OBS-010 verified SLO/error-budget boundary

`PRH_SLO_ERROR_BUDGET_V1@1.0.0` uses integer ppm/bps and SLI AVAILABILITY/LATENCY/CORRECTNESS/FRESHNESS/MIGRATION_ERRORS. Correctness accepts allowlisted technical machine evidence only. No financial truth/write or paid-provider authority.

## TEST-010 verified testing boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` classifies all tracked tests into pure, migration/recovery, adapter/integration, runtime, UI/E2E and policy/governance. Unknown/ambiguous classification is fail-closed. DESIGN-020 contract test belongs to UI_E2E as named `Design system`; VIZ-020 contract test belongs to UI_E2E as named `Visualization foundation`.

## ANL-010 verified analytics boundary

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` defines renderer/storage-neutral query/results and delegates financial KPI semantics to FIN-010 `evaluateKpis()`. `financial_write=false`. VIZ-020 consumes semantic dimension/measure IDs but не изменяет AnalyticsQuery/AnalyticsResult semantics.

## MIG-010 historical verified boundary

Owner-private full-history migration remains DONE/OWNER_VERIFIED with `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Authorized execution was governed by `MIG010_EXECUTION_POLICY_V1@1.0.0`; finalize could enter `FINALIZED_PENDING_RECONCILIATION` and was not considered complete until post-write reconciliation reached the verified boundary. This one-time authorization/evidence never grants later generic write authority. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations.

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

VIZ-020 remains IN_PROGRESS until visualization contract/registry/interaction/adapter/docs/tests are green, trusted runtime evidence passes and Main Verification closes Issue #120.

## MASTER-G3 state

`MASTER-G3 / Canonical platform` complete. Private full-history reconciliation = PASS. Synthetic PERF-014 20k/50k performance = PASS. FIN/DATA/ARCH/ANL/MIG/PERF/DOC dependencies = DONE. R2 is dependency-ready.

## Executable continuation protocol

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` select/continue exactly one dependency-ready writer. Multiple writers, missing dependencies or private context fail closed.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers always `READ_ONLY`, `writer_authority:false`; P0/P1 block, P2/P3 advisory. Review never overrides machine gates/Main Verification.

## Privacy / financial / cost boundaries

Real or real-derived household finance data stays private. Public finance fixtures are independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys, migration artifacts и real renderer options stay private. `FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`.  
DATA-010: `PRH_CANONICAL_TRANSACTION_V1`.  
ARCH-010: `PRH_APPLICATION_CORE_V1`; no I/O/network/financial-write authority.  
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; Google mutation blocked.  
ANL-010: `PRH_ANALYTICS_CONTRACT_V1`; no financial-write authority.  
TEST-010: `PRH_TEST_ARCHITECTURE_V1`; test authority only.  
OBS-010: `PRH_SLO_ERROR_BUDGET_V1`; technical SLO authority only.  
PERF-010: `PRH_GOOGLE_QUERY_PROJECTION_V1`; read-plan authority only.  
PERF-011: `PRH_REVISION_AWARE_READ_CACHE_V1`; cache reuse authority only.  
PERF-012: `PRH_SINGLE_SCAN_REFRESH_V1`; bounded refresh snapshot reuse authority only.  
PERF-013: `PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1`; affected-bucket materialization authority only.  
PERF-014: `PRH_SYNTHETIC_SCALE_GATE_V1`; synthetic CI performance-gate authority only.  
DOC-010: `PRH_R1_DOCUMENTATION_V1`; documentation coherence authority only.  
DESIGN-020: `PRH_DESIGN_SYSTEM_V1`; presentation-token/theme/accessibility authority only.  
VIZ-020: `PRH_VISUALIZATION_FOUNDATION_V1`; renderer-neutral spec/registry/interaction/renderer-adapter authority only; no query/financial/storage/write authority.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Issue #120
4. `/docs/PROJECT_STATUS.md`
5. `/docs/architecture/VISUALIZATION_FOUNDATION.md`
6. `/docs/adr/ADR-VIZ-020-ECHARTS-6.md`
7. `/lib/visualization/visualization_foundation.v1.json`
8. `/lib/visualization/visualization_foundation.js`
9. `/tests/visualization_foundation_contract_test.js`
10. `/docs/design/DESIGN_SYSTEM.md`
11. `/lib/design/design_system.v1.json`
12. `/lib/documentation/r1_documentation.v1.json`
13. exact candidate code/tests/workflows

## Scope handoff

`AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`; `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010`, `PERF-011`, `PERF-012`, `PERF-013`, `PERF-014`, `DOC-010`, `DESIGN-020` = DONE. `MASTER-G3 = complete`. `VIZ-020` = current R2 writer. `HOME-020` and other VIZ-dependent R2 work remain dependency-gated until VIZ-020 Main Verification.