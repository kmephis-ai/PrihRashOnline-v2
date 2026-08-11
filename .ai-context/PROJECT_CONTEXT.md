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

`ANL-073` — единственный **current writer**, Issue #186, branch `agent/ANL-073-pivot-olap-engine`. Его зависимости `ANL-070` и `ANL-072` уже DONE/Main Verification PASS. BENCH-070 также DONE и остаётся отдельным upstream comparison layer, а не частью Pivot semantics.

ANL-073 вводит `PRH_PIVOT_OLAP_V1@1.0.0`: renderer-neutral multi-dimensional Pivot/OLAP поверх полного canonical `AnalyticsResult`. Pivot не читает transactions напрямую, не вычисляет KPI заново и не меняет `FIN-TRUTH-v1`. Rows + columns покрывают source dimensions, selected measures в v1 обязаны быть additive и использовать только `SUM`; non-additive aggregation guessing запрещён.

Поддерживаются deterministic rows/columns/measures, sparse additive zero cells, prefix subtotals, grand-total reconciliation, explicit sort, bounded Top-N + `__OTHER__`, TIME hierarchy re-query и runtime drill descriptor. Top-N обязан переиспользовать ANL-072 `TOP_N_OTHER`. Hierarchy YEAR -> MONTH -> DAY принадлежит ANL-070; expand/collapse формирует новый canonical AnalyticsQuery и требует re-execution, а не синтезирует детализацию из totals.

Cell drill разрешён только при exact source `query_hash`: исходный canonical query сохраняет глобальные filters, выбранные dimension members сужаются до EQ, `time_bucket` превращается в exact half-open range, а VIZ-020 `PRH_DRILL_CONTEXT_V1` остаётся configuration interaction contract. Runtime drill может содержать private values внутри private app, но PivotSpec и public telemetry financial/dimension payload не содержат.

Public tests — independently generated synthetic only, включая seeded randomized row-order parity. Public telemetry содержит только schema/version/spec/query hashes, axis/measure/member/cell/subtotal counts, Top-N/hierarchy flags и technical decision/reason. `financial_truth=false`, `financial_write=false`, `io=false`, `network=false`, `storage=false`, `renderer=false`, `ui=false`, `query_execution=false`; `FREE_ONLY` обязателен.

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
- `ANL-073` — **current writer**, Issue #186, branch `agent/ANL-073-pivot-olap-engine`; IN_PROGRESS до Main Verification.

Trusted delivery reliability bootstrap #185 также merged в `main` commit `7794f1d73631cc50ac1d603758ddec85acdec6b5`: trusted Apps Script executor допускает bounded retry только `prhReleaseHealthCheckToken + RUNTIME_HEALTH_BUILD_MISMATCH` (12 attempts, 5000 ms, max sleep 55 s); OAuth/transport/workbook/R2 smoke/timeout и другие failures остаются fail-fast. Exact SHA/sourceTreeHash acceptance не ослаблена.

ANL-073 machine boundary:

- contract `lib/analytics/pivot_olap.v1.json` — `PRH_PIVOT_OLAP_V1@1.0.0`;
- implementation `lib/analytics/pivot_olap.js`;
- test `tests/pivot_olap_contract_test.js`;
- normative doc `docs/analytics/PIVOT_OLAP_ENGINE.md`;
- named gate `Pivot/OLAP engine`;
- PivotSpec schemas `PRH_PIVOT_SPEC_V1`, `PRH_PIVOT_RESULT_V1`, `PRH_PIVOT_DRILL_DESCRIPTOR_V1`, `PRH_PIVOT_HIERARCHY_REQUERY_V1`;
- max total dimensions = 3; row max = 2; column max = 2;
- v1 aggregation = additive `SUM` only;
- source = complete non-truncated `PRH_ANALYTICS_RESULT_V1`, comparison mode NONE, exact source dimensions/grain;
- Top-N = reuse `PRH_ANALYTICS_CALCULATED_METRICS_V1:TOP_N_OTHER`;
- sparse missing combinations = explicit zero only for additive orchestration;
- subtotal/grand total exact reconcile with source;
- hierarchy detail always re-queries canonical AnalyticsQuery; implicit detail synthesis=false;
- drill requires base query hash parity; `OTHER`/unsupported null drill fail closed;
- PivotSpec/public telemetry financial payload=false; runtime result/drill stay private;
- `financial_truth=false`, `financial_write=false`, `io=false`, `network=false`, `storage=false`, `renderer=false`, `ui=false`, `query_execution=false`; `FREE_ONLY` mandatory.

ANL-073 после Main Verification разблокирует `PERF-070`; затем `TEST-070` требует ANL-073 + PERF-070 и уже завершённые ANL-071/072/074/SCOPE-070/BENCH-070. `VIZ-070` остаётся отдельным renderer-registry item и не реализуется скрыто внутри Pivot core.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. `subscription_detection_contract_test.js`, `calculated_metrics_contract_test.js`, `personal_benchmark_contract_test.js` и `pivot_olap_contract_test.js` принадлежат `PURE_DOMAIN_APPLICATION`. Named gates `Subscription detection`, `Calculated/window metrics`, `Personal benchmark comparisons`, `Pivot/OLAP engine` обязательны; red gate bypass запрещён.

## MIG-010 historical verified boundary

Owner-private migration остаётся DONE/OWNER_VERIFIED: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`; это occurrence-aware capability, а не право AI/CI выбирать семантику дубликатов.

Historical authorized execution policy = `MIG010_EXECUTION_POLICY_V1@1.0.0`, strategy `STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`. После finalize execution останавливается в `FINALIZED_PENDING_RECONCILIATION`; только отдельная owner-private reconciliation с `unexplainedMismatch=0` завершает verified lifecycle.

GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI не могут переиспользовать historical authorization для будущей financial mutation. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` exact-bound и non-reusable. Текущая write authority = false.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

ANL-073 остаётся открытым до green `Pivot/OLAP engine` + existing BENCH/ANL/SCOPE/FIN/DATA/SUB/privacy/FREE_ONLY/full layered/UI/PWA gates, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Read-only multi-AI review

Read-only multi-AI review: required roles `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review не может отменять красный machine gate.

## Scope handoff

Все R0, R1, R2 через UI-MIG-020, завершённые R3 включая SUB-030, YC-040, AUTH-040, ANL-070, SCOPE-070, ANL-071, ANL-072, BENCH-070 и ANL-074 — DONE. YC-041/YC-042 BLOCKED. `ANL-073` — единственный active writer.
