# ANL-070 — семантический реестр аналитики

## Назначение

`PRH_ANALYTICS_SEMANTIC_REGISTRY_V1@1.0.0` — нормативный мета-контракт между финансовой истиной и универсальным аналитическим интерфейсом. Реестр отвечает на вопрос «какие measure, dimension, aggregation и hierarchy допустимо комбинировать», но **не вычисляет и не переопределяет финансовые показатели**.

Финансовая семантика остаётся у `FIN-TRUTH-v1` и `PRH_KPI_DICTIONARY_V1@1.0.0`. Исполняемым query-контрактом остаётся `PRH_ANALYTICS_CONTRACT_V1@1.0.0`; ANL-070 только валидирует поддержанность комбинации до выполнения запроса.

## Measures

Реестр содержит ровно тот же набор measures, что и ANL-010/KPI Dictionary: `INCOME`, `EXPENSE`, `CASH_FLOW`, `SAVINGS`, `BUDGET_VARIANCE`, `GROSS_EXPENSE`, `REFUND`, `TRANSFER`.

Для каждого measure фиксируются:

- ссылка на authoritative KPI;
- output field и тип `MONEY_MINOR`;
- формат `QUERY_CURRENCY_MINOR`;
- разрешённые aggregation IDs;
- допустимые dimensions и time grains;
- признак аддитивности;
- обязательные query parameters.

Семь transaction-derived measures используют `SUM` как аддитивную partition semantics поверх KPI-native результата. Это не новая формула: каждая группа по-прежнему вычисляется существующим KPI evaluator.

`BUDGET_VARIANCE` — отдельный non-additive scalar KPI. Текущий ANL-010 требует `budget_minor` и запрещает grouping/grain, поэтому semantic registry явно фиксирует `SCALAR_KPI`, `UNGROUPED_ONLY`, отсутствие supported dimensions и grain только `NONE`. Попытка сгруппировать budget variance обязана завершиться `DENY`, а не неявно распределить бюджет по категориям.

## Dimensions

Groupable query dimensions остаются ровно теми, которые исполняет ANL-010:

- `account_id`;
- `category_id`;
- `member_id`;
- `project_id`;
- `type`.

`status` и `tag` присутствуют в semantic dimension catalog как filter-only поля. Они не становятся group dimensions раньше отдельного расширения query contract.

`time_bucket` — derived dimension из `occurred_at`. Он не передаётся в `dimensions[]`; его выбор задаётся `grain`. Поддерживаются только уже существующие `DAY`, `MONTH`, `YEAR`. ANL-070 не добавляет `WEEK`, `QUARTER`, rolling windows или произвольные периоды — это scope ANL-071.

Каждая canonical dimension содержит источник, field, nullable/multi-value semantics, cardinality class и capabilities group/filter/sort. Registry contract проверяет, что referenced canonical fields реально существуют в `PRH_CANONICAL_TRANSACTION_V1`.

## Иерархии

На текущем уровне доказана одна настоящая hierarchy: `TIME` с упорядоченными уровнями `YEAR → MONTH → DAY`. Разрешены только соседние drill-down transitions `YEAR → MONTH` и `MONTH → DAY`.

Category/account/member/project parent-child hierarchy не объявляется, потому что canonical dataset пока не содержит соответствующего authoritative parent relationship. Добавлять искусственную иерархию ради UI запрещено.

## Fail-closed compatibility

`lib/analytics/semantic_registry.js` возвращает bounded `ALLOW`/`DENY` decision. DENY обязателен для:

- неизвестного measure/dimension/aggregation/grain/hierarchy level;
- duplicate measure/dimension;
- превышения max dimensions;
- filter-only dimension в grouping;
- aggregation, не разрешённой measure contract;
- measure/dimension или measure/grain комбинации вне registry;
- несоседнего/обратного time hierarchy transition.

Red semantic decision нельзя обходить renderer-ом, dashboard-specific code или ручным marker.

## Границы ответственности

ANL-070:

- не меняет формулы KPI и `FIN-TRUTH-v1`;
- не меняет `AnalyticsQuery/AnalyticsResult` execution semantics;
- не содержит financial dataset или result values;
- не зависит от ECharts и другого renderer;
- не имеет storage/network/IO/UI/financial-write authority;
- не меняет Google/YDB ownership или migration state;
- использует только public-safe metadata и synthetic contract evidence;
- соблюдает `FREE_ONLY`.

Следующие Roadmap items расширяют возможности отдельно: ANL-071 — periods/comparisons, ANL-072 — calculated/window metrics, ANL-073 — pivot/OLAP, ANL-074 — exploration state. Их будущая функциональность не считается реализованной ANL-070.

## Privacy-safe observability

Разрешённая telemetry содержит только schema/version, decision/reason, semantic IDs, grain/hierarchy IDs и counts. Prompt/response, transaction payload, description/counterparty, amounts, private account identifiers и runtime/cloud locators не входят в evidence.

## Проверка

Named gate `Semantic analytics registry` запускает `tests/semantic_analytics_registry_contract_test.js`. Тест проверяет полный registry против ANL-010, KPI Dictionary и canonical schema, все зарегистрированные measures/dimensions/hierarchy transitions, adversarial invalid combinations, отсутствие renderer/runtime/write authority и privacy-safe telemetry.
