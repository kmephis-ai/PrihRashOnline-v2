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

`ANL-072` — единственный active writer. Текущая разработка не меняет финансовые строки, не переписывает пользовательский интерфейс и не вводит новый источник финансовой истины. Она добавляет безопасный чистый слой аналитических преобразований поверх уже рассчитанных `AnalyticsResult` и period/comparison results. Любой ИИ, продолжающий эту ветку, обязан сохранять upstream authority `FIN-TRUTH-v1`, KPI Dictionary, `ANL-010`, `ANL-070` и `ANL-071` и не переносить формулы доходов/расходов в новый слой.

Ключевая граница — отсутствие произвольных формул. Разрешён только заранее версионированный allowlist операторов. Пользовательская строка JavaScript, `eval`, SQL expression, динамическая formula DSL или похожий executable payload должны отклоняться fail-closed. Неизвестный measure, неподходящая provenance, усечённый AnalyticsResult, недопустимое окно или structurally incompatible comparison series также не должны обрабатываться эвристически.

Public tests используют только независимо сгенерированные synthetic finance fixtures. Telemetry может содержать только технические версии, operator/measure identifiers, размеры окна/Top-N, counts и bounded reason codes. Финансовые суммы, исходные названия категорий/счетов, transaction IDs и другие private dimension values в public evidence запрещены. Новый слой не имеет storage/network/deployment/write authority и не требует платного API.

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

SUB-030 machine authority `PRH_SUBSCRIPTION_DETECTION_V1@1.0.0` сохранена в новом base. Его named gate `Subscription detection`, test architecture classification, LANG-RU doc inventory и privacy boundaries нельзя удалять или перетирать при реализации ANL-072. SUB detector остаётся precision-first, `auto_confirm=false`, `auto_create_obligation=false`, `canonical_mutation=false`, `financial_write=false`, `financial_truth=false`; fuzzy/LLM matching не является authority.

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
- `ANL-072` — **current writer**, Issue #178, branch `agent/ANL-072-safe-calculated-metrics-v2`; IN_PROGRESS до Main Verification.

ANL-072 machine boundary:

- contract: `lib/analytics/calculated_metrics.v1.json` — `PRH_ANALYTICS_CALCULATED_METRICS_V1@1.0.0`;
- implementation: `lib/analytics/calculated_metrics.js`;
- test: `tests/calculated_metrics_contract_test.js`;
- normative doc: `docs/analytics/CALCULATED_METRICS.md`;
- named gate: `Calculated/window metrics`;
- source: complete typed canonical `AnalyticsResult` или `PRH_ANALYTICS_PERIOD_RESULT_V1` с валидной provenance;
- allowlist: `SHARE`, `DELTA_ABS`, `DELTA_PCT`, `CUMULATIVE`, `MOVING_AVERAGE`, `MOVING_MEDIAN`, `TOP_N_OTHER`;
- arbitrary JavaScript/eval/SQL/executable formula surface = forbidden;
- ratio = deterministic integer PPM, `1 000 000 = 100%`;
- money = safe integer minor units; risk-of-overflow intermediates используют exact integer arithmetic;
- `SHARE` = exact 1 000 000 PPM reconciliation, zero/negative denominator fail-closed;
- `DELTA_PCT` = explicit `ZERO_REFERENCE_NO_CHANGE` / `ZERO_REFERENCE_UNDEFINED`, never NaN/Infinity;
- pairwise delta требует одинаково структурированных primary/reference bucket series; arbitrary multi-month calendar split не сопоставляется эвристически;
- moving window bounded 1..24 и требует explicit `REQUIRE_FULL` или `ALLOW_PARTIAL`;
- missing additive partition внутри временного ряда = zero только для orchestration, без synthetic transaction mutation;
- `TOP_N_OTHER` = bounded N, deterministic canonical dimension-key tie break, stable `__OTHER__`, exact source/output reconciliation;
- truncated source, duplicate/invalid rows, unsupported measure/operator/window/reference или invalid provenance = fail-closed;
- telemetry не содержит amount payload/private dimension values;
- `financial_truth=false`, `financial_write=false`, `io=false`, `network=false`, `storage=false`, `renderer=false`, `ui=false`, `executable_formula=false`; `FREE_ONLY` mandatory.

ANL-072 не меняет enum/semantics upstream contracts и после Main Verification разблокирует `BENCH-070` и `ANL-073`. Его первый superseded PR #181 был закрыт без merge после того, как SUB-030 автономно вошёл в `main`; current v2 branch создан от merge `2914f150...` и обязана сохранить SUB-030 machine gates.

## TEST-010 boundary

`PRH_TEST_ARCHITECTURE_V1@1.0.0` классифицирует каждый tracked test fail-closed. `subscription_detection_contract_test.js` и `calculated_metrics_contract_test.js` оба принадлежат `PURE_DOMAIN_APPLICATION`. Named gates `Subscription detection` и `Calculated/window metrics` оба обязательны; red gate bypass запрещён.

## MIG-010 historical verified boundary

Owner-private migration остаётся DONE/OWNER_VERIFIED: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`; это occurrence-aware identity capability, а не разрешение AI/CI выбирать семантику дубликатов.

GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; AI/CI также не могут переиспользовать историческое owner authorization для будущей financial mutation. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` exact-bound и non-reusable. Текущая write authority = false.

## Current delivery

```text
PR Validation
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification
```

ANL-072 остаётся открытым до green `Calculated/window metrics` + existing SUB/FIN/DATA/ANL/privacy/FREE_ONLY/full layered/UI/PWA gates, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Read-only multi-AI review

Required roles остаются `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers = `READ_ONLY`, `writer_authority=false`; review не может отменять красный machine gate.

## Scope handoff

Все R0, R1, R2 через UI-MIG-020, завершённые R3 включая SUB-030, YC-040, AUTH-040, ANL-070, SCOPE-070, ANL-071 и ANL-074 — DONE. YC-041/YC-042 остаются BLOCKED. `ANL-072` — единственный active writer.
