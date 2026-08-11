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

`BENCH-070` — единственный **current writer**, Issue #80, branch `agent/BENCH-070-personal-comparison-engine`. Он стартовал только после Main Verification PASS всех зависимостей: `ANL-071`, `ANL-072` и `SCOPE-070`.

Цель — единый versioned comparison layer для предыдущего сопоставимого периода, персонального rolling baseline, budget, target и manual index. Этот слой не меняет canonical transactions, `FIN-TRUTH-v1`, KPI Dictionary, period semantics или scope semantics. `PREVIOUS_COMPARABLE_PERIOD` обязан переиспользовать ANL-071 и `DELTA_ABS`/`DELTA_PCT` ANL-072; `PERSONAL_ROLLING_BASELINE` обязан переиспользовать `MOVING_AVERAGE` ANL-072. Budget/target/manual index остаются declared references с `financial_truth=false`.

Comparison core работает только с typed scalar additive analytic results до реализации `ANL-073`. Несовпадение period/currency/scope/provenance, неизвестный comparison type, non-additive measure, invalid rolling window или invalid manual index завершаются fail-closed. Arbitrary JavaScript/eval/SQL/executable formula surface отсутствует.

Public tests используют только independently generated synthetic finance fixtures. Public telemetry содержит только технические schema/version/type/period/scope/sample/quality/reason metadata и не содержит `current_minor`, `reference_minor`, delta values, transaction IDs или private dimension IDs. External market-data providers не являются required dependency; core не использует network/API и сохраняет `FREE_ONLY`.

## Current R0 truth

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. Исполнимая AI-инженерная цепочка уже канонизирована: `AIENG-001 = DONE` -> `AIENG-002 = DONE` -> `AIENG-003 = DONE`; далее `AIENG-004`, `AIENG-005` и `AIENG-006` также DONE/Main Verification PASS. Этот handoff сохраняется как нормативный lifecycle anchor и не заменяется текущим R7 writer.

Real or real-derived household finance data stays private. Публичный repository содержит только public-safe contracts, synthetic finance fixtures и privacy-safe machine evidence; private OAuth, runtime locators, реальные строки/агрегаты и owner-private payload не публикуются.

## Current R1 truth

`MASTER-G3` — complete. R1 canonical platform завершена:

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private reconciliation = OWNER_VERIFIED.
- `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`, `AIENG-005` — DONE/Main Verification PASS.

FIN authority остаётся `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority — `PRH_CANONICAL_TRANSACTION_V1`; repository authority — `PRH_TRANSACTION_REPOSITORY_V1`. Generic Google canonical write остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. `PRH_AI_EVAL_SUITE_V1@1.0.0` остаётся local deterministic synthetic regression gate и не выдаёт authority.

Post-R1 handoff historically начинается с `DESIGN-020`; этот anchor обязан оставаться в lifecycle docs даже после завершения R2.

## Current R2 truth

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS. `UI-MIG-020` Issue #172 завершён, candidate `867fda74824f91bf3931aa3e6ea39d1c7d4dfc1e`, merge `0a87bab34f29897fa781a030797a9a040fb200a3`.

Canonical private Web App default = R2 Financial Home. Generated exact-candidate runtime строится из canonical `lib/**`; `financial_formula_copy=false`. Private transient dimension projection использует `PRH_RUNTIME_DIMENSION_LABEL_HASH_V1` только как read-only adapter identity и не получает persistent identity authority. Authenticated private Home smoke V3 и Trusted Runtime Health PASS. Private Web App остаётся `MYSELF`, `NOT_PROVEN_CURRENT_HOST` остаётся текущей PWA service-worker boundary, `FREE_ONLY` обязателен.

## Current R3 truth

- `TREND-030` — DONE, Issue #164 Main Verification PASS.
- `PROJ-030` — DONE, Issue #166 Main Verification PASS.
- `GOAL-030` — DONE, Issue #168 Main Verification PASS.
- `BAL-030` — DONE, Issue #76 Main Verification PASS.
- `NW-030` — DONE, Issue #171 Main Verification PASS.
- `SUB-030` — **DONE**, Issue #179 Main Verification PASS, candidate `2c3a0a39aa835cec2a5fa0a93d0a275b7bf008fd`, merge `2914f150a9b038af50f7ccbfd9ed3d4f684dad47`.

SUB-030 authority `PRH_SUBSCRIPTION_DETECTION_V1@1.0.0` сохраняется. Named gate `Subscription detection`, TEST-010 classification, LANG-RU inventory и privacy boundaries нельзя удалять. Detector остаётся precision-first: `auto_confirm=false`, `auto_create_obligation=false`, `canonical_mutation=false`, `financial_write=false`, `financial_truth=false`; fuzzy/LLM matching не является authority.

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
- `ANL-074` — **DONE**, Issue #155 Main Verification PASS.
- `ANL-072` — **DONE**, Issue #178 Main Verification PASS, candidate `0cc1260edb0a264d662a813abc04c1236bb44655`, merge `19866dfe6856d42dca89e8469c3520e7c2f3c437`.
- `BENCH-070` — **current writer**, Issue #80, branch `agent/BENCH-070-personal-comparison-engine`; IN_PROGRESS до Main Verification.

BENCH-070 machine boundary:

- contract `lib/analytics/personal_benchmark.v1.json` — `PRH_PERSONAL_BENCHMARK_V1@1.0.0`;
- implementation `lib/analytics/personal_benchmark.js`;
- test `tests/personal_benchmark_contract_test.js`;
- normative doc `docs/analytics/PERSONAL_BENCHMARKS.md`;
- named gate `Personal benchmark comparisons`;
- allowlist: `PREVIOUS_COMPARABLE_PERIOD`, `PERSONAL_ROLLING_BASELINE`, `BUDGET`, `TARGET`, `MANUAL_INDEX`;
- source scope = normalized `PRH_ANALYTICS_SCOPE_V1`; period source = `PRH_ANALYTICS_PERIOD_RESULT_V1`;
- previous comparison reuses ANL-071 range/quality and ANL-072 delta operators;
- rolling baseline excludes current bucket and reuses ANL-072 `MOVING_AVERAGE` with bounded window 2..24;
- BUDGET/TARGET require exact period/currency/scope and provenance `DECLARED_BUDGET` / `DECLARED_TARGET`;
- MANUAL_INDEX requires explicit bounded positive PPM and `USER_DEFINED_MANUAL_INDEX` provenance;
- reference/result `financial_truth=false`; no implicit persistence or write authority;
- external market provider required = false; paid provider required = false;
- public telemetry financial payload = false;
- `financial_write=false`, `io=false`, `network=false`, `storage=false`, `renderer=false`, `ui=false`, `external_market_data=false`; `FREE_ONLY` mandatory.

ANL-072 machine authority `PRH_ANALYTICS_CALCULATED_METRICS_V1@1.0.0` остаётся upstream и не модифицируется BENCH-070. После Main Verification BENCH-070 будет выполненной зависимостью `TEST-070`; `ANL-073` остаётся отдельным следующим OLAP work item и не реализуется скрыто внутри benchmark layer.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует tracked tests fail-closed. `subscription_detection_contract_test.js`, `calculated_metrics_contract_test.js` и `personal_benchmark_contract_test.js` принадлежат `PURE_DOMAIN_APPLICATION`. Named gates `Subscription detection`, `Calculated/window metrics` и `Personal benchmark comparisons` обязательны; red gate bypass запрещён.

## MIG-010 historical verified boundary

Owner-private migration остаётся DONE/OWNER_VERIFIED: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`; это occurrence-aware identity capability, а не разрешение AI/CI выбирать семантику дубликатов.

Historical authorized execution policy остаётся `MIG010_EXECUTION_POLICY_V1@1.0.0` со strategy `STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`. После finalize выполнение останавливается в `FINALIZED_PENDING_RECONCILIATION` до отдельной post-write reconciliation; только owner-private reconciliation с `unexplainedMismatch=0` завершает verified lifecycle.

GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI также не могут переиспользовать историческое owner authorization для будущей financial mutation. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` exact-bound и non-reusable. Текущая write authority = false.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

BENCH-070 остаётся открытым до green `Personal benchmark comparisons` + existing ANL/SCOPE/FIN/DATA/SUB/privacy/FREE_ONLY/full layered/UI/PWA gates, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Read-only multi-AI review

Required roles остаются `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review не может отменять красный machine gate.

## Scope handoff

Все R0, R1, R2 через UI-MIG-020, завершённые R3 включая SUB-030, YC-040, AUTH-040, ANL-070, SCOPE-070, ANL-071, ANL-072 и ANL-074 — DONE. YC-041/YC-042 остаются BLOCKED. `BENCH-070` — единственный active writer.
