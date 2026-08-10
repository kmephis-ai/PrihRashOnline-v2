# PERF-013 — Incremental analytics aggregates

Статус: `IN_PROGRESS` до Main Verification.  
Machine contract: `PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0`.  
Roadmap: `PERF-013`, dependencies `PERF-012 = DONE`, `ANL-010 = DONE`.

## Цель

Сохранить materialized агрегаты для наиболее частых аналитических разрезов и обновлять только затронутые buckets после изменения canonical dataset. Полный ANL-010 recompute остаётся эталоном корректности и fallback.

Начальный набор projections:

- `MONTH` — `occurred_at` в UTC `YYYY-MM`;
- `CATEGORY_ID` — `category_id`;
- `ACCOUNT_ID` — source `account_id`, в точности как одноимённая ANL-010 dimension.

Поддерживаемые measures: `INCOME`, `EXPENSE`, `CASH_FLOW`, `SAVINGS`, `GROSS_EXPENSE`, `REFUND`, `TRANSFER`. `BUDGET_VARIANCE` не материализуется: его budget input относится к конкретному query context, а ANL-010 запрещает budget grouping.

## Финансовая семантика

PERF-013 не содержит собственных формул. Каждый bucket вычисляется через FIN-010 `evaluateKpis()`. Parity проверяется через ANL-010 `evaluateAnalytics()`.

- posted/status, refund, transfer и exact-money semantics принадлежат KPI Dictionary;
- UI/renderer не являются authority;
- `financial_write=false`;
- mixed currency fail-closed до FX layer.

## State contract

`PRH_INCREMENTAL_ANALYTICS_AGGREGATES_STATE_V1` содержит:

- exact `canonical_revision`;
- currency;
- materialized projection rows;
- private runtime `membership_index` по `transaction_id`, содержащий SHA-256 canonical fingerprint и bucket membership;
- `state_hash`, связывающий revision, projections и membership index.

Aggregate values и membership index являются private runtime state. Они не публикуются в telemetry/evidence.

Перед incremental update state полностью валидируется и проверяется по `state_hash`. Caller обязан передать exact `expected_base_revision`; mismatch fail-closed.

## Delta model

Следующий canonical snapshot валидируется и получает authoritative `repositoryRevision()`.

По `transaction_id` и SHA-256 stable canonical transaction fingerprint строятся три класса:

- `ADDED`;
- `REMOVED`;
- `CHANGED`.

Для каждого delta transaction собираются его old/new buckets по всем projections. Только объединение этих affected buckets пересчитывается из next canonical snapshot. Не затронутые materialized rows переносятся из проверенного prior state.

Это сознательно безопаснее арифметического `+/- amount`: сложные правила refund/transfer/status остаются внутри FIN-010 evaluator, а incremental optimization ограничивается выбором buckets для recompute.

Если canonical revision и membership fingerprints не изменились, update возвращает `NOOP` и не пересчитывает buckets.

## Correctness / tamper boundary

Fail-closed:

- unknown/malformed state revision;
- invalid schema/version/currency;
- invalid projection shape/order/measures;
- `state_hash` mismatch;
- caller `expected_base_revision` mismatch;
- contradiction между changed revision и empty delta либо identical revision и non-empty delta;
- mixed currency.

После update `canonical_revision` всегда вычисляется из next canonical snapshot. Synthetic test сравнивает incremental state с fresh full build и ANL-010 full recompute.

## Public-safe evidence

Разрешены только technical поля:

- operation/status;
- domain-separated base/result revision hash prefixes;
- added/removed/changed counts;
- affected/recomputed bucket counts;
- projection count.

Запрещены transaction IDs, bucket labels, aggregate values, суммы и любой canonical/financial payload.

## Rollback

Удалить `incremental_aggregates.*`, contract test, named PR gate и эту документацию. PERF-012 single-scan refresh + ANL-010 full recompute продолжают работать как authoritative path без materialized aggregates.
