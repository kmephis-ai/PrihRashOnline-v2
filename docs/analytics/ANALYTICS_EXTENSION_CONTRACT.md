# ANL-010 — Analytics extension contract v1

`roadmap_id: ANL-010`  
`machine contract: PRH_ANALYTICS_CONTRACT_V1@1.0.0`  
`query: PRH_ANALYTICS_QUERY_V1`  
`result: PRH_ANALYTICS_RESULT_V1`

## Цель

ANL-010 вводит pure, versioned и renderer/storage-neutral analytics boundary поверх `PRH_CANONICAL_TRANSACTION_V1` и FIN-010 `PRH_KPI_DICTIONARY_V1`.

Контракт отвечает на вопрос **что посчитать и как структурировать результат**, но не определяет chart renderer, Dashboard widget, Google Sheets layout или future YDB query syntax. Эти детали остаются adapters/UI concerns и развиваются отдельными Roadmap items.

## Source of financial truth

Analytics engine не дублирует формулы Income/Expense/Cash Flow/Savings/Budget/Refund/Transfer. Каждая supported measure делегируется FIN-010 `evaluateKpis()` и поэтому наследует `FIN-TRUTH-v1`:

- money — integer minor units;
- single explicit currency;
- только `posted` учитывается в financial totals;
- transfer не входит в Income/Expense/Cash Flow;
- refund уменьшает expense;
- `CASH_FLOW = INCOME - EXPENSE`;
- `SAVINGS = CASH_FLOW`;
- partial period — explicit `[start,end)` без implicit proration;
- legacy total cells и UI/chart logic не являются authoritative.

Изменение этих semantics требует отдельной versioned FIN task, а не локального условия в analytics renderer/query.

## AnalyticsQuery v1

Query имеет strict shape и fail-closed reject неизвестных полей/IDs/комбинаций.

Обязательные identity/policy fields:

- `schema = PRH_ANALYTICS_QUERY_V1`;
- `contract_version = 1.0.0`;
- `currency` — explicit ISO-like uppercase 3-letter code;
- `measures` — непустой ordered набор supported KPI IDs.

Supported measures v1:

`INCOME`, `EXPENSE`, `CASH_FLOW`, `SAVINGS`, `BUDGET_VARIANCE`, `GROSS_EXPENSE`, `REFUND`, `TRANSFER`.

Supported dimensions v1:

`account_id`, `category_id`, `member_id`, `project_id`, `type`.

`dimensions: []` является валидным ungrouped query и возвращает один aggregate row даже для пустого scoped dataset.

Supported filters v1:

- fields: `account_id`, `category_id`, `member_id`, `project_id`, `type`, `status`, `tag`;
- operators: `EQ`, `IN`;
- filter/value lists bounded;
- duplicate/unknown filters fail closed;
- порядок filters и порядок `IN` values не должен менять canonical query identity.

Filter применяется до KPI evaluation. Если filter выбирает `pending`/`void`, FIN-010 всё равно сохраняет canonical posted-only semantics; analytics layer не переопределяет status accounting rules.

## Time range и grain

`time_range` — half-open interval `[start,end)` в ISO day representation.

Supported grain:

- `NONE`;
- `DAY`;
- `MONTH`;
- `YEAR`.

Любой grain кроме `NONE` требует explicit `time_range`. Time bucket является result dimension `time_bucket`, но не частью Canonical Transaction schema.

## Comparison v1

Supported mode:

- `NONE`;
- `PREVIOUS_PERIOD`.

`PREVIOUS_PERIOD` требует explicit current range и строит непосредственно предшествующий interval с тем же количеством календарных дней. Никакой implicit month/year normalization или proration в v1 нет.

Comparison result хранится отдельно в `comparison_measures`, чтобы current financial value не смешивался с comparison semantics.

## Budget variance

`BUDGET_VARIANCE` требует explicit `parameters.budget_minor` в integer minor units.

В v1 budget variance намеренно разрешён только для ungrouped `grain=NONE` query. Распределять один budget по category/member/time buckets без отдельной versioned allocation policy запрещено: это создало бы новую финансовую семантику вне FIN-010.

Если scoped dataset пуст, result остаётся FIN-010-compatible: expense = 0, поэтому budget variance = `budget_minor`, а не искусственный zero.

## Sort и limits

Sort может ссылаться только на выбранную measure/dimension; неизвестный/невыбранный key fail-closed. Stable fallback ordering строится по canonical dimension key.

Result rows bounded `max_rows=5000`; превышение обозначается `truncated=true`, а `total_rows` сохраняет deterministic full row count.

## Deterministic identity и provenance

Normalized query сериализуется canonical stable JSON и получает SHA-256 `query_hash`. Equivalent filter ordering/value ordering canonicalizes в одинаковую identity.

`AnalyticsResult` содержит:

- `schema = PRH_ANALYTICS_RESULT_V1`;
- contract version + query hash;
- currency/time/grain/comparison;
- deterministic rows;
- `total_rows` / `truncated`;
- provenance.

Provenance v1 связывает result с:

- analytics contract version;
- query hash;
- Canonical Transaction schema;
- KPI Dictionary version;
- `FIN-TRUTH-v1`;
- deterministic canonical input revision.

`legacy_total_cells_used=false`, `ui_logic_used=false` являются machine truth, а не advisory metadata.

## Pure boundary

`lib/analytics/**` не имеет:

- `SpreadsheetApp`/Apps Script service dependency;
- DOM/renderer dependency;
- network authority;
- storage write authority;
- financial write authority.

Analytics engine принимает plain canonical transactions и возвращает plain immutable result. Adapter может получить canonical transactions из Google/YDB/repository port, но storage choice не меняет analytics contract.

## Privacy

Public tests/docs используют только independently generated synthetic finance data.

Не публикуются real или real-derived transactions, amounts, category/account/member distributions, aggregates, screenshots, authenticated runtime bodies или private identifiers. Runtime query/result с real household data остаётся private.

Public evidence ограничивается contract version, supported IDs, reason codes, schema/result shape, technical hashes и synthetic parity PASS/FAIL.

## Fail-closed examples

ANL-010 отвергает:

- unknown measure/dimension/filter/operator;
- malformed/empty measure list;
- invalid currency/time range;
- grain без time range;
- comparison без time range;
- budget parameter без `BUDGET_VARIANCE`;
- grouped/grained budget variance без allocation policy;
- sort по невыбранному field;
- unknown query field.

## Non-goals v1

ANL-010 не реализует:

- `ChartSpec`/`WidgetSpec` и renderer selection — это VIZ-020;
- pivot engine, window metrics, formula AST, semantic registry — это более поздние R7 items;
- forecast/scenario/AI insight semantics;
- real financial writes;
- Google -> Yandex cutover;
- Dashboard redesign.

Эта узкая граница нужна именно для того, чтобы будущие UI/analytics возможности расширялись поверх одного проверяемого financial/query contract, а не размножали business logic по виджетам.
