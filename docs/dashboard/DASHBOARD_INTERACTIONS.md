# DASH-082 — Global filters, cross-filter и brush event bus

## Назначение

`PRH_DASHBOARD_INTERACTION_BUS_V1@1.0.0` — configuration-only interaction layer между DASH-081 bound widgets и каноническим `PRH_EXPLORATION_STATE_V1@1.0.0` из ANL-074.

Слой обрабатывает пять типов событий:

- `CLICK` — одиночный выбор semantic dimension value;
- `SELECTION` — multi-select или явная очистка одного dimension field;
- `BRUSH` — bounded selection по `time_bucket`;
- `RESET` — канонический reset Exploration State;
- `BACK` — возврат к предыдущему Exploration State через существующую history semantics ANL-074.

DASH-082 не исполняет `AnalyticsQuery`, не вычисляет FIN-TRUTH и не изменяет DashboardSpec/layout/binding. Его единственная mutation boundary для пользовательских interaction events — `global_context.filter_context` ANL-074.

## Upstream authority

DASH-082 переиспользует, а не копирует:

- `PRH_WIDGET_FACTORY_V1@1.0.0` — validity и semantic query binding source widget;
- `PRH_EXPLORATION_STATE_V1@1.0.0` — canonical global/widget/drill state, history, RESET/BACK;
- `PRH_FILTER_CONTEXT_V1@1.0.0` — filter item schema/operators/value limits;
- `FIN-TRUTH-v1` — финансовая семантика остаётся upstream и не принадлежит event bus.

Все authority `financial_truth`, `financial_write`, `query_execution`, `query_mutation`, `canonical_mutation`, `authorization`, `storage`, `network`, `deployment`, `renderer`, `layout` равны `false`. `FREE_ONLY` обязателен.

## Registry

`PRH_DASHBOARD_INTERACTION_REGISTRY_V1` содержит только валидные `PRH_DASHBOARD_BOUND_WIDGET_V1` из DASH-081.

Registry нормализуется детерминированно по `widget_id` и получает `registry_hash = SHA256_CANONICAL_JSON_V1`. Reorder входного списка widgets не меняет canonical registry identity.

Source capability выводится из canonical binding, а не задаётся отдельным непроверяемым флагом:

- допустимые поля = query dimensions;
- при `grain != NONE` добавляется derived `time_bucket`;
- `KPI/CARD` обычно не могут инициировать cross-filter, поскольку DASH-081 требует для них ungrouped query;
- `CHART` обязан иметь `ChartSpec.interactions.filter=true`;
- `BRUSH` разрешён только если `time_bucket` действительно bound source query.

Unknown/unbound source widget fail closed.

## Event contract

`PRH_DASHBOARD_INTERACTION_EVENT_V1` имеет фиксированную форму. Root gesture использует `origin_event_id=null`, `hop=0`; canonical `event_id` вычисляется по нормализованному event body через `SHA256_CANONICAL_JSON_V1`, после чего root `origin_event_id` становится равен `event_id`.

Programmatic propagation сохраняет исходный `origin_event_id` и увеличивает `hop`. Это не даёт renderer/event adapter создавать новую пользовательскую identity для callback, возникшего вследствие уже применённого interaction.

### SET

`CLICK/SELECTION/BRUSH` с `operation=SET` принимают canonical `field`, `operator`, `values`.

- `CLICK` — максимум одно value;
- `SELECTION` — до 64 values;
- `BRUSH` — только `field=time_bucket`, `operator=INCLUDE`, до 64 canonical bucket values.

Значения нормализуются/сортируются по правилам FilterContext. Financial result payload в event запрещён.

### CLEAR

`SELECTION` и `BRUSH` могут передать `operation=CLEAR`, `operator=null`, `values=[]`. Удаляется только global filter того же field. `CLICK` не используется для implicit clear.

## Shared global filter semantics

Для обычного interaction bus строит следующий FilterContext так:

1. берёт текущий `global_context.filter_context`;
2. удаляет только entries того же `field`;
3. при `SET` добавляет новый canonical filter item;
4. при `CLEAR` не добавляет replacement;
5. передаёт результат в `ANL-074 SET_GLOBAL_CONTEXT` с неизменным global `scope_spec`.

После dispatch machine invariants проверяют, что:

- `widget_contexts` не изменились;
- `drill_context` не изменился;
- global `scope_spec` не изменился.

Следовательно cross-filter не может незаметно превратиться в widget-local override, drill или scope mutation.

## Cross-widget propagation effects

Для `CLICK/SELECTION/BRUSH` result перечисляет зарегистрированные target widgets, кроме source widget. Это только derived effect metadata для UI adapters. Event bus не изменяет их layout, binding или query.

Для `RESET/BACK` affected set включает все зарегистрированные widgets, поскольку canonical shared state изменяется/восстанавливается для всей dashboard surface.

## Loop/replay protection

`PRH_DASHBOARD_INTERACTION_SESSION_V1` содержит:

- canonical ANL-074 exploration session;
- bounded `processed_origin_ids` (до 128);
- deterministic `session_hash`.

Перед mutation bus проверяет `origin_event_id`. Если origin уже обработан, результат:

- `decision=IGNORED`;
- `reason=DASH082_EVENT_ORIGIN_REPLAY`;
- exploration/session state не мутируется;
- affected widgets пусты.

`max_hop=1`. Попытка дальнейшей propagation цепочки завершается `DASH082_EVENT_HOP_LIMIT_EXCEEDED`. Комбинация origin dedup + hop bound не позволяет feedback callback образовать event cycle.

No-op state transition также не создаёт новый ANL-074 history entry: это гарантирует существующий `pushState()` exploration contract.

## RESET/BACK reproducibility

DASH-082 не реализует собственную альтернативную history stack. `RESET` и `BACK` напрямую делегируются `EXPLORATION.dispatch()`.

Поэтому RESET -> BACK восстанавливает предыдущий `state_hash` и исходную ANL-074 history semantics. Interaction session хранит только replay protection metadata поверх этого состояния.

## Privacy

Filter values и query configuration могут быть private runtime metadata. Они не должны попадать в public evidence или telemetry.

Public tests используют только synthetic identifiers. Telemetry allowlist:

- `schema`;
- `version`;
- `event_type`;
- `source_widget_hash_prefix`;
- `origin_hash_prefix`;
- `state_hash_prefix`;
- `affected_widget_count`;
- `decision`;
- `reason`.

Source widget ID хешируется до prefix. Filter field/value, query filters, currency, measure, transaction rows и financial values в telemetry отсутствуют.

Payload guard fail closed отклоняет result/dataset/transaction/amount-like keys в interaction payloads.

## Детерминизм

Canonical JSON identity не зависит от порядка object keys. Registry сортирует widgets по ID, filter values сортируются canonical FilterContext, target effects сортируются.

Одинаковый initial Exploration Session + registry + последовательность events дают одинаковые:

- event IDs;
- ANL-074 state hashes;
- interaction session hashes;
- affected widget effects.

## Тестирование

`tests/dashboard_interaction_bus_contract_test.js` покрывает:

- registry order independence;
- source semantic capabilities;
- click по категории;
- multi-select replacement;
- clear одного field;
- time brush;
- сохранение unrelated global filters;
- сохранение widget/drill/scope state;
- source exclusion из propagation targets;
- origin replay/feedback loop prevention;
- propagation hop limit;
- RESET/BACK exact restoration;
- deterministic sequence replay;
- unknown/KPI/disabled CHART/unbound source failures;
- hostile financial payload;
- privacy-safe telemetry.

Required named gate: `Dashboard interaction bus`.

Existing DASH-081/DASH-080/ANL-074/PRIV/STUDIO/VIZ/R2/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

## Rollback

Rollback DASH-082 удаляет interaction bus contract/core/tests/docs/gates. DASH-081 bound widgets остаются валидными, ANL-074 Exploration State остаётся canonical, а Dashboard composer возвращается к состоянию без cross-filter dispatch layer.
