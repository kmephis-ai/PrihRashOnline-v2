# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, private scope assignments и owner-private payload запрещены.

## LANG-RU

Русский язык — единственный нормативный язык human-facing документации, GitHub metadata и AI instructions. Machine identifiers, API/schema fields, library/protocol/standard names и команды сохраняются без искусственного перевода. Параллельный English source of truth запрещён.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — Executable GitHub Roadmap v2.3.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Versioned contracts + architecture/ADR/operations docs.

## Текущая инженерная задача

`TEST-070` — единственный **current writer**, Issue #190, branch `agent/TEST-070-combinatorial-analytics-regression`. Все его зависимости `ANL-071`, `ANL-072`, `ANL-073`, `ANL-074`, `SCOPE-070`, `BENCH-070`, `PERF-070` уже DONE/Main Verification PASS.

TEST-070 вводит `PRH_COMBINATORIAL_ANALYTICS_REGRESSION_V1@1.0.0` как test-only integration evidence поверх существующей semantic analytics architecture. Он не добавляет financial/business formulas и не изменяет FIN-TRUTH, AnalyticsQuery/AnalyticsResult, Period, Calculated Metrics, Scope, Benchmark, Pivot или Planner semantics.

Version 1: synthetic dataset 720 rows; deterministic seed `7341824`; 48 representative cases; hard max 96; sampling `SEEDED_BOUNDED_ROTATION`; full Cartesian product запрещён. Failure identity = `seed + case_id`.

Matrix комбинирует `EXPENSE|INCOME|CASH_FLOW`, scalar/category/account/member/project/category+account, posted/type/account/category/tag filters, full/year windows и `NONE|MONTH|YEAR` grains. Для каждого case обязательны query normalization/hash determinism, exact integer-minor results, FIN-TRUTH provenance, additive reconciliation и PERF-070 cold/warm parity.

Cross-layer evidence отдельно связывает scope overlay, ANL-074 exploration include/exclude composition, ANL-071 period comparison, ANL-072 moving average, BENCH-070 rolling/previous comparison, ANL-073 Pivot/Top-N reconciliation и PERF-070 revision invalidation. Transfer-only cash flow остаётся zero; implicit FX conversion отсутствует; grouped BUDGET_VARIANCE и truncated Pivot fail closed.

Public telemetry/report содержит только schema/version/seed/case_count/query_hash_prefix_count/status/reason. Raw query, rows, amounts и private dimension values запрещены. Runtime budget 20 s — CI regression ceiling, не user SLA. `financial_truth=false`, `financial_write=false`, `storage=false`, `network=false`, `deployment=false`, `ui=false`, `renderer=false`; `FREE_ONLY` обязателен.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. Исполнимая AI-инженерная цепочка канонизирована: `AIENG-001 = DONE` -> `AIENG-002 = DONE` -> `AIENG-003 = DONE`; далее `AIENG-004`, `AIENG-005` и `AIENG-006` также DONE/Main Verification PASS. Этот handoff остаётся lifecycle anchor и не заменяется текущим R7 writer.

Real or real-derived household finance data stays private. Public repository содержит только public-safe contracts, synthetic finance fixtures и privacy-safe machine evidence; private OAuth, runtime locators, реальные строки/агрегаты и owner-private payload не публикуются.

## Current R1 truth

`MASTER-G3` — complete.

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private stage `OWNER_VERIFIED`.
- `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`, `AIENG-005` — DONE/Main Verification PASS.

FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`; repository authority = `PRH_TRANSACTION_REPOSITORY_V1`. Generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. `PRH_AI_EVAL_SUITE_V1@1.0.0` — local deterministic synthetic regression gate и не выдаёт authority.

Post-R1 handoff historically начинается с `DESIGN-020`; этот anchor обязан оставаться в lifecycle docs даже после завершения R2.

## Current R2 truth

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS. `UI-MIG-020` Issue #172 завершён, candidate `867fda74824f91bf3931aa3e6ea39d1c7d4dfc1e`, merge `0a87bab34f29897fa781a030797a9a040fb200a3`.

Canonical private Web App default = R2 Financial Home. Generated exact-candidate runtime строится из canonical `lib/**`; `financial_formula_copy=false`. `PRH_RUNTIME_DIMENSION_LABEL_HASH_V1` остаётся transient read-only adapter identity без persistent authority. Authenticated private Home smoke V3 и Trusted Runtime Health PASS. Web App остаётся `MYSELF`; PWA boundary `NOT_PROVEN_CURRENT_HOST`; `FREE_ONLY` обязателен.

## Current R3 truth

- `TREND-030` — DONE, Issue #164 Main Verification PASS.
- `PROJ-030` — DONE, Issue #166 Main Verification PASS.
- `GOAL-030` — DONE, Issue #168 Main Verification PASS.
- `BAL-030` — DONE, Issue #76 Main Verification PASS.
- `NW-030` — DONE, Issue #171 Main Verification PASS.
- `SUB-030` — **DONE**, Issue #179 Main Verification PASS, candidate `2c3a0a39aa835cec2a5fa0a93d0a275b7bf008fd`, merge `2914f150a9b038af50f7ccbfd9ed3d4f684dad47`.

SUB-030 authority `PRH_SUBSCRIPTION_DETECTION_V1@1.0.0` сохраняется. Named gate `Subscription detection`, TEST-010 classification, LANG-RU inventory и privacy boundaries нельзя удалять. Detector precision-first: `auto_confirm=false`, `auto_create_obligation=false`, `canonical_mutation=false`, `financial_write=false`, `financial_truth=false`; fuzzy/LLM matching не authority.

## Current R4 truth

- `YC-040` — DONE/Main Verification PASS.
- `AUTH-040` — DONE/Main Verification PASS.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`, `writer_authority=false`.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`, `writer_authority=false`.

Google remains authoritative. Blocked cloud items не дают writer authority, не создают billing-backed resources и не меняют canonical write ownership.

## Current R7 truth

- `ANL-070` — **DONE**, Issue #150 Main Verification PASS.
- `SCOPE-070` — **DONE**, Issue #77 Main Verification PASS.
- `ANL-071` — **DONE**, Issue #153 Main Verification PASS.
- `ANL-072` — **DONE**, Issue #178 Main Verification PASS, merge `19866dfe6856d42dca89e8469c3520e7c2f3c437`.
- `BENCH-070` — **DONE**, Issue #80 Main Verification PASS, candidate `4da05a25669b87cc7711bde5d8502c457af71f09`, merge `e49d07fa79bd1f0c825b4b1c807ddd8bb49d6a8f`.
- `ANL-074` — **DONE**, Issue #155 Main Verification PASS.
- `ANL-073` — **DONE**, Issue #186 Main Verification PASS, merge `116b950cf4ae66b813dff3cf7c8803afeb6baea6`.
- `PERF-070` — **DONE**, Issue #188 Main Verification PASS, candidate `7742f56746dcbc5b782e0320acb82478a5f13775`, merge `0c3b09e5221b55854fb3c007e66c815ebdedc584`.
- `TEST-070` — **current writer**, Issue #190, branch `agent/TEST-070-combinatorial-analytics-regression`; IN_PROGRESS до Main Verification.

Trusted delivery reliability bootstrap #185 merged в `main` commit `7794f1d73631cc50ac1d603758ddec85acdec6b5`: trusted Apps Script executor допускает bounded retry только `prhReleaseHealthCheckToken + RUNTIME_HEALTH_BUILD_MISMATCH` (12 attempts, 5000 ms, max sleep 55 s); OAuth/transport/workbook/R2 smoke/timeout и другие failures остаются fail-fast. Exact SHA/sourceTreeHash acceptance не ослаблена.

TEST-070 machine boundary:

- contract `lib/testing/combinatorial_analytics_regression.v1.json` — `PRH_COMBINATORIAL_ANALYTICS_REGRESSION_V1@1.0.0`;
- test `tests/combinatorial_analytics_regression_contract_test.js`;
- normative doc `docs/testing/COMBINATORIAL_ANALYTICS_REGRESSION.md`;
- named gate `Combinatorial analytics regression`;
- TEST-010 class `PURE_DOMAIN_APPLICATION`;
- seed `7341824`, synthetic rows 720, representative cases 48, hard max 96;
- query hash/order determinism + integer-minor/additive reconciliation mandatory;
- Scope/Exploration/Period/Calculated/Benchmark/Pivot/Planner cross-layer contracts reused, not redefined;
- planner cold/warm and aggregate reuse deep parity with canonical evaluator;
- revision change invalidates stale cache identity;
- transfer-neutral cash flow and no implicit FX conversion;
- unsupported grouped budget variance/truncated Pivot fail closed;
- public evidence technical-only, no finance/private payload;
- `financial_truth=false`, `financial_write=false`, `storage=false`, `network=false`, `deployment=false`, `ui=false`, `renderer=false`; `FREE_ONLY` mandatory.

После TEST-070 Main Verification `MASTER-G7 / Semantic analytics` становится complete при сохранении DONE остальных R7 items. `VIZ-070` остаётся отдельным P2 renderer-registry item и не реализуется скрыто внутри TEST-070.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. `subscription_detection_contract_test.js`, `calculated_metrics_contract_test.js`, `personal_benchmark_contract_test.js`, `pivot_olap_contract_test.js`, `analytics_query_planner_cache_contract_test.js`, `analytics_query_planner_performance_contract_test.js` и `combinatorial_analytics_regression_contract_test.js` принадлежат `PURE_DOMAIN_APPLICATION`. Named gates `Subscription detection`, `Calculated/window metrics`, `Personal benchmark comparisons`, `Pivot/OLAP engine`, `Analytics query planner/cache`, `Combinatorial analytics regression` обязательны; red gate bypass запрещён.

## MIG-010 historical verified boundary

Owner-private migration остаётся DONE/OWNER_VERIFIED: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`; это occurrence-aware capability, а не право AI/CI выбирать семантику дубликатов.

Historical authorized execution policy = `MIG010_EXECUTION_POLICY_V1@1.0.0`, strategy `STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`. После finalize execution останавливается в `FINALIZED_PENDING_RECONCILIATION`; только отдельная owner-private reconciliation с `unexplainedMismatch=0` завершает verified lifecycle.

GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI не могут переиспользовать historical authorization для будущей financial mutation. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` exact-bound и non-reusable. **Current write authority = false**.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

TEST-070 остаётся открытым до green `Combinatorial analytics regression` + existing PERF/ANL/BENCH/Pivot/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Read-only multi-AI review

Read-only multi-AI review: required roles `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review не может отменять красный machine gate.

## Scope handoff

Все R0, R1, R2 через UI-MIG-020, завершённые R3 включая SUB-030, YC-040, AUTH-040, ANL-070, SCOPE-070, ANL-071, ANL-072, BENCH-070, ANL-073, ANL-074 и PERF-070 — DONE. YC-041/YC-042 BLOCKED. `TEST-070` — единственный active writer.
