# DASH-083 — Drill-down и drill-through

## Назначение

`PRH_DASHBOARD_DRILL_V1@1.0.0` — orchestration-only слой между DASH-081 semantic widgets, ANL-074 Exploration State и TX-020 Transaction Explorer. Он отвечает за переход по аналитической иерархии, сохранение context и переход к canonical transaction evidence, но не создаёт новую финансовую формулу или storage/write authority.

Поддерживаются:

- time hierarchy `YEAR -> QUARTER -> MONTH -> DAY`;
- runtime category hierarchy;
- runtime account hierarchy;
- drill-through в TX-020;
- exact reconciliation поддержанных totals через FIN KPI Dictionary.

## Authority boundary

DASH-083 не имеет authority для:

- изменения `AnalyticsQuery` semantics;
- вычисления нового FIN-TRUTH;
- изменения canonical transactions;
- financial write;
- storage/network/auth/deploy;
- изменения DASH-080 layout;
- изменения TX-020 search/sort/edit semantics;
- замены ANL-074 history/reset/back semantics.

`financial_truth=false`, `financial_write=false`, `query_execution=false`, `query_mutation=false`, `canonical_mutation=false`, `storage=false`, `network=false`, `authorization=false`, `deployment=false`.

`FREE_ONLY` обязателен.

## Time hierarchy и QUARTER

Canonical AnalyticsQuery v1 поддерживает grain `NONE/DAY/MONTH/YEAR`. Поэтому DASH-083 **не добавляет `QUARTER` как новый AnalyticsQuery grain**.

`QUARTER` является navigation level. Выбранный quarter переводится в explicit `[start,end)` window, например `2026-Q1 -> [2026-01-01, 2026-04-01)`. Следующий аналитический запрос может использовать уже существующий `MONTH` grain внутри этого окна.

Допустимые переходы строго последовательны:

- `YEAR -> QUARTER`;
- `QUARTER -> MONTH`;
- `MONTH -> DAY`.

Skip/reverse переход fail closed. Calendar parser проверяет реальные даты и boundaries.

## Category/account hierarchy registry

`PRH_DASHBOARD_DRILL_HIERARCHY_REGISTRY_V1` принимает private-runtime hierarchy metadata только в виде:

- hierarchy ID `CATEGORY` или `ACCOUNT`;
- canonical dimension (`category_id` / `account_id`);
- ordered levels;
- nodes `{node_id, level, parent_id}`.

Labels/descriptions в hierarchy registry запрещены. Таким образом private category/account labels не становятся частью public config/evidence.

Каждый non-root node обязан иметь parent предыдущего уровня. Leaf node ID является canonical dimension ID. Для выбранного parent deterministic traversal вычисляет bounded leaf ID set; максимум — 64.

## DASH-081 source validation

Drill source обязан быть валидным `PRH_DASHBOARD_BOUND_WIDGET_V1`.

- выбранный measure должен присутствовать в bound `AnalyticsQuery`;
- time drill требует `grain != NONE`;
- category/account drill требует соответствующую bound dimension;
- derived binding hashes перепроверяются через DASH-081 factory;
- unbound/unknown/incompatible source fail closed.

## ANL-074 context preservation

DASH-083 использует ANL-074 как единственный source of truth для exploration state.

При `DOWN/THROUGH` меняется только `PRH_DRILL_CONTEXT_V1` через `SET_DRILL_CONTEXT`. Global context и widget contexts после transition сравниваются с состоянием до transition; любое неожиданное изменение блокирует operation.

Effective transaction context строится из:

1. bound AnalyticsQuery filters;
2. ANL-074 effective global/widget FilterContext;
3. текущего DrillContext;
4. effective ScopeSpec;
5. source query time range и текущего time drill window.

Navigation metadata не содержит финансовых totals.

## Дополнительная drill metadata session

VIZ DrillContext намеренно минимален и не хранит hierarchy level/time window. Поэтому DASH-083 использует `PRH_DASHBOARD_DRILL_SESSION_V1` для supplementary navigation metadata.

Этот session **не заменяет ANL-074 history**. DOWN/RESET добавляют соответствующую metadata snapshot только вместе с ANL state transition. `BACK` сначала делегируется `EXPLORATION.dispatch(BACK)`, затем synchronously восстанавливает предыдущую drill metadata. `RESET -> BACK` возвращает тот же ANL state hash и drill hash.

## Drill-through request

`PRH_DASHBOARD_DRILL_THROUGH_REQUEST_V1` содержит:

- source widget ID;
- supported measure ID;
- currency;
- explicit period;
- effective ScopeSpec;
- effective FilterContext;
- bounded TX-020 query;
- hashes context/drill/request.

TX query использует только native TX-020 fields: date/account/category/member/type/status, stable sort и bounded page. Filters, которых нет в TX query schema (например project/tag/exclude), применяются к canonical collection **до** вызова TX-020, используя уже нормализованный VIZ FilterContext. После этого pagination/search/sort выполняет именно TX-020.

## Canonical transaction selection

Для reconciliation DASH-083 не копирует TX matching/sort logic. Он вызывает `TX.exploreTransactions()` постранично с одним normalized request и получает transaction IDs из canonical projections. Затем IDs сопоставляются с уже validated canonical input collection.

Максимум reconciliation matches = 5000. Переполнение fail closed.

## FIN-backed reconciliation

Runtime reconciliation получает:

- canonical transactions;
- private scope assignment overlay при наличии;
- versioned drill-through request;
- upstream analytic cell total (`expected_total_minor`).

Порядок:

1. canonical collection validation;
2. SCOPE-070 application;
3. VIZ/ANL effective filter application;
4. TX-020 selection/pagination;
5. `KPI.evaluateKpi()` на exact selected canonical rows;
6. comparison FIN result с upstream analytic total.

Поддержанные measures v1:

- `INCOME`;
- `EXPENSE`;
- `CASH_FLOW`.

Refund/transfer/status semantics принадлежат FIN KPI Dictionary / `FIN-TRUTH-v1`; DASH-083 их не повторяет.

При equality receipt = `PASS`, transaction evidence считается reconciled. При mismatch:

- `status=MISMATCH`;
- reason `DASH083_TOTAL_RECONCILIATION_MISMATCH`;
- `rows_reconciled=false`;
- Explorer rows не возвращаются как подтверждённое evidence.

`expected_total_minor/actual_total_minor` — private runtime reconciliation fields. Они не разрешены в telemetry/public evidence.

## Privacy и telemetry

Public tests используют только independently generated synthetic canonical transactions/IDs.

Telemetry allowlist:

- `schema`;
- `version`;
- `action`;
- `widget_hash_prefix`;
- `context_hash_prefix`;
- `drill_hash_prefix`;
- `request_hash_prefix`;
- `result_count`;
- `decision`;
- `reason`.

Запрещены amounts, currency, filter values, transaction IDs, category/account labels и private hierarchy labels.

## Fail-closed reason classes

В частности:

- unknown hierarchy/level;
- invalid skip/reverse transition;
- invalid parent-child continuity;
- time selection outside parent window;
- source dimension/measure not bound;
- unsupported reconciliation measure;
- contradictory time window;
- hierarchy descendants overflow;
- TX selection identity mismatch;
- reconciliation match limit exceeded;
- total reconciliation mismatch.

Ни один из этих случаев не даёт fallback на guessed query/financial formula.

## Тестирование

`tests/dashboard_drill_through_contract_test.js` покрывает:

- deterministic hierarchy registry identity;
- `YEAR -> QUARTER -> MONTH -> DAY`;
- explicit quarter/time windows;
- category/account parent-child traversal;
- ANL-074 context preservation;
- AnalyticsQuery + DrillContext merge;
- TX-020 query derivation;
- INCOME/EXPENSE/CASH_FLOW FIN reconciliation;
- mismatch fail closed;
- BACK/RESET restoration;
- invalid hierarchy/source/measure;
- privacy-safe telemetry.

Required named gate: `Dashboard drill-through`.

Existing DASH-082/DASH-081/TX-020/ANL-074/VIZ/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

## Rollback

Rollback удаляет DASH-083 contract/core/tests/docs/gate. DASH-082 interaction bus, DASH-081 bindings, ANL-074 state и TX-020 Transaction Explorer остаются canonical и не требуют data migration.
