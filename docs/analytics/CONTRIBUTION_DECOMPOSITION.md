# ANL-090 — Contribution and change decomposition

## Назначение

`PRH_CONTRIBUTION_DECOMPOSITION_V1@1.0.0` — deterministic analytics layer, который объясняет **изменение canonical additive measure между двумя сопоставимыми периодами** через вклад отдельных semantic drivers.

V1 поддерживает driver dimensions:

- `category_id`;
- `account_id`;
- `member_id`;
- `project_id`;
- `tag_id`.

Core additive measures: `INCOME`, `EXPENSE`, `CASH_FLOW`. Дополнительная measure может участвовать только если semantic registry доказывает additive/SUM semantics и не маркирует её ratio/share/average/median/non-additive.

ANL-090 является arithmetic decomposition, а не causal model. `causality_claimed=false` является обязательным machine invariant.

## Upstream authority

ANL-090 опирается на:

- `PRH_ANALYTICS_CONTRACT_V1@1.0.0`;
- ANL-070 semantic measure/dimension registry;
- ANL-071 explicit period/comparison semantics;
- VIZ-090 `PRH_ADVANCED_VISUALIZATION_PACK_V1@1.0.0`;
- `FIN-TRUTH-v1`.

Он не импортирует FIN/KPI evaluator как второй financial authority и не читает canonical transactions напрямую. Input — уже вычисленные canonical semantic aggregates, exact-bound к AnalyticsQuery hashes.

## Request

`PRH_CONTRIBUTION_REQUEST_V1` содержит:

- одну additive `measure`;
- одну supported `dimension`;
- explicit `current_query`;
- explicit `reference_query`.

Оба query проходят canonical `normalizeAnalyticsQuery()`.

Требования:

1. ровно одна measure, совпадающая с request;
2. driver dimension присутствует в обоих queries;
3. на driver dimension нет уже наложенного base filter — иначе decomposition не является полной driver decomposition;
4. query structures идентичны после исключения только `time_range`;
5. оба периода explicit и имеют одинаковый span;
6. currency, filters других dimensions, grain, comparison, sort, parameters, limit и прочие query semantics совпадают.

ANL-090 не создаёт собственный альтернативный period format. Он читает ISO-date bounds из уже нормализованного canonical `time_range` и использует их только для compatibility proof.

## Period aggregate input

`PRH_CONTRIBUTION_PERIOD_AGGREGATE_V1` содержит:

- exact `query_hash`;
- versioned `source_contract`;
- exact safe-integer `total`;
- zero-or-more unique `{driver_id,value}` rows.

Перед decomposition каждый период самостоятельно reconciles:

`Σ driver values == period total`.

Duplicate driver, unsafe integer, invalid query hash, malformed provenance или total mismatch fail closed.

## Missing driver semantics

Driver union строится по current/reference rows.

Если driver присутствует только в одном периоде, отсутствующая сторона получает **zero только для arithmetic decomposition**. Это не считается imputation canonical dataset и не меняет upstream missing-data truth.

States:

- `NEW` — driver отсутствовал в reference и есть в current;
- `REMOVED` — был в reference, отсутствует в current;
- `UNCHANGED` — exact delta=0;
- `INCREASE` — delta>0;
- `DECREASE` — delta<0.

Arithmetic всегда одна:

`delta = current - reference`.

Для EXPENSE знак **не инвертируется** ради визуальной интерпретации: рост расхода остаётся positive arithmetic change. Human interpretation может быть «хуже/лучше» в отдельном product layer, но не меняет decomposition truth.

## Triple reconciliation

ANL-090 использует три уровня proof.

### 1. Current period

`Σ current driver values = current total`.

### 2. Reference period

`Σ reference driver values = reference total`.

### 3. Delta

Для union drivers:

`Σ (current_i - reference_i) = current total - reference total`.

Любой mismatch/overflow fail closed.

Result хранит exact:

- current total;
- reference total;
- total delta;
- absolute-change total;
- driver count;
- changed count;
- ordered contribution rows.

## Ordering и materiality

Rows сортируются deterministic:

1. `absolute_delta` descending;
2. signed `delta` descending;
3. opaque `driver_id` ascending.

После сортировки фиксируется `rank`.

`materiality_bps` показывает долю `abs(delta)` в общей absolute movement. Если движения нет, value=0.

`net_contribution_bps` относится к net total delta. Если net delta=0 при взаимно компенсирующих изменениях, field = `null` и `zero_total_delta=true`; система не делит на zero и не создаёт вымышленный процент.

Percent/bps fields — presentation metadata. Exact signed integer delta остаётся authority.

## Evidence descriptors

Каждая contribution row получает `PRH_CONTRIBUTION_EVIDENCE_V1`.

Descriptor содержит:

- driver dimension/id;
- hash driver identity;
- current/read-only AnalyticsQuery proposal;
- reference/read-only AnalyticsQuery proposal;
- exact query hashes;
- current/reference period hashes;
- `financial_values_in_navigation=false`;
- `financial_write=false`.

Evidence query строится из исходного canonical query добавлением exact `IN` filter по driver. Он снова проходит `normalizeAnalyticsQuery()` и получает собственный canonical query hash.

Это reproducible drill/evidence proposal. ANL-090 не выполняет query и не выдаёт write authority.

Driver IDs являются private runtime configuration/evidence. Public GitHub tests используют только synthetic IDs; telemetry raw IDs не содержит.

## Waterfall handoff

`toWaterfallSource()` создаёт `PRH_ADVANCED_VISUALIZATION_SOURCE_V1`:

- shape = `WATERFALL`;
- query hash = current exact query hash;
- source contract = `PRH_CONTRIBUTION_DECOMPOSITION_V1@1.0.0`;
- START = reference total;
- DELTA rows = все non-zero contributions в deterministic materiality order;
- END = current total.

DELTA IDs в waterfall source строятся из hash driver identity, а не raw private driver ID.

VIZ-090 независимо повторно проверяет:

`START + Σ DELTA = END`.

Renderer получает только готовую arithmetic decomposition и не становится source of financial truth.

## Causality boundary

Contribution отвечает на вопрос: «какая часть арифметического изменения связана с изменением агрегата этого driver?»

Она **не отвечает** на вопрос «почему это произошло» в причинном смысле.

ANL-090 не формирует claims вроде:

- категория вызвала финансовую проблему;
- account стал причиной роста расходов;
- project повлиял на доход в causal sense.

Такие выводы требуют отдельной evidence/model policy; VIZ-090 также сохраняет no-causality boundary.

## Determinism

Identity не зависит от:

- порядка object keys;
- порядка aggregate rows;
- исходного порядка driver union.

Canonical hashes:

- request hash;
- aggregate hashes;
- evidence hashes;
- result hash;
- downstream VIZ waterfall source identity.

Timestamp не участвует в identity.

## Privacy и telemetry

Telemetry allowlist:

- schema/version;
- measure;
- dimension;
- request/result hash prefixes;
- current/reference query hash prefixes;
- driver/changed counts;
- decision/reason.

Не допускаются:

- current/reference totals;
- contribution amounts;
- driver IDs/labels;
- filter values;
- transaction IDs;
- runtime locators.

Public evidence — independently generated synthetic only.

## Authority boundary

Все ANL-090 authorities = false:

- financial truth;
- financial write;
- query execution/mutation;
- canonical mutation;
- storage/network/auth/deployment;
- renderer.

ANL-090 не добавляет paid/external service. `FREE_ONLY` обязателен.

## Machine evidence

`tests/contribution_decomposition_contract_test.js` проверяет:

- INCOME/EXPENSE/CASH_FLOW arithmetic;
- category/account/member/project/tag dimensions;
- NEW/REMOVED/UNCHANGED/INCREASE/DECREASE;
- current/reference/total-delta reconciliation;
- positive/negative/zero net change;
- zero-net offset semantics;
- empty zero periods;
- deterministic ordering/hash при reordered inputs;
- period/context/query incompatibility;
- driver-filter conflict;
- aggregate total/query/provenance/duplicate corruption;
- exact evidence query filters/hashes;
- VIZ-090 WATERFALL independent conservation;
- privacy-safe telemetry;
- отсутствие financial-write/storage/network authority.

Required named gate: `Contribution decomposition`.

Existing VIZ-090/VIZ-070/ANL-070..074/BENCH/PERF/TEST/DASH/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

## Rollback

Rollback ANL-090 удаляет decomposition contract/core/tests/docs/gate. VIZ-090 и R7/R8 analytics/dashboard contracts остаются canonical; financial data/storage migration не требуется.
