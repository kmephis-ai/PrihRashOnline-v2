# ANL-074 — модель состояния аналитического исследования

## Назначение

`PRH_EXPLORATION_STATE_V1@1.0.0` задаёт единое воспроизводимое состояние режима Explore: глобальные и widget-level фильтры, выбранный analytics scope, drill context, reset/back и URL-safe состояние private Web App. Контракт объединяет уже доказанные VIZ-020 и SCOPE-070 primitives, но **не создаёт второй filter DSL и не меняет финансовую истину**.

ANL-074 переиспользует:

- `PRH_FILTER_CONTEXT_V1@1.0.0` и его `INCLUDE`/`EXCLUDE` semantics из VIZ-020;
- `PRH_DRILL_CONTEXT_V1@1.0.0` из VIZ-020;
- `PRH_ANALYTICS_SCOPE_SPEC_V1` из SCOPE-070;
- semantic IDs из `PRH_ANALYTICS_SEMANTIC_REGISTRY_V1@1.0.0`.

## Global и widget context

Global context всегда содержит нормализованный FilterContext и валидный ScopeSpec. Canonical default использует пустой FilterContext и built-in scope `DEFAULT_ANALYSIS`.

Widget context содержит:

- stable `widget_id`;
- собственный FilterContext;
- `scope_mode`;
- optional ScopeSpec только для явного override.

Разрешены ровно два режима scope:

- `INHERIT_GLOBAL` — widget использует global scope точно как есть; `scope_spec` у widget должен быть `null`;
- `OVERRIDE` — widget использует собственный полностью валидированный ScopeSpec; implicit merge с global scope отсутствует.

Это специально предотвращает неочевидное объединение двух policy scopes. Если пользователь выбрал отдельную область для widget, это должна быть явная целая policy, а не скрытая смесь include/exclude правил.

## Композиция фильтров

Все входные filters сначала нормализуются VIZ-020. Effective context строится детерминированно по field:

- несколько `INCLUDE` для одного field дают **пересечение множеств**;
- несколько `EXCLUDE` дают **объединение множеств**;
- exclusion применяется после include;
- если после пересечения/исключения effective INCLUDE пуст, состояние считается противоречивым и fail-closed с `EXPLORATION_FILTER_CONTRADICTION`.

Порядок filters и widget contexts не влияет на canonical state hash. Выход снова проходит VIZ normalizer, поэтому ANL-074 не обходит исходные ограничения FilterContext.

## Drill context

Drill state хранит нормализованный VIZ `PRH_DRILL_CONTEXT_V1`. Для effective drill filters объединяются:

1. global filters;
2. filters source widget;
3. filters самого DrillContext.

Композиция использует те же deterministic INCLUDE-intersection / EXCLUDE-union rules. `source_widget_id` и target проверяются VIZ-020. ANL-074 не реализует hierarchy drill-through или navigation event bus — это отдельные downstream Roadmap items.

## Canonical state и identity

Canonical state содержит только:

- schema/version;
- global context;
- отсортированный по `widget_id` массив widget contexts;
- optional drill context.

`state_hash` = SHA-256 canonical JSON. Derived hashes VIZ contexts не дублируются внутри state body: они повторно вычисляются upstream normalizers при проверке.

Финансовые datasets/results/rows/measures и private scope assignment overlay в state запрещены. Exploration state — это **configuration**, а не снимок финансовых данных.

## Session history, reset и back

`PRH_EXPLORATION_SESSION_V1` содержит current canonical state и bounded history максимум 32 предыдущих состояний.

Поддерживаются actions:

- `SET_GLOBAL_CONTEXT`;
- `SET_WIDGET_CONTEXT`;
- `REMOVE_WIDGET_CONTEXT`;
- `SET_DRILL_CONTEXT`;
- `CLEAR_DRILL_CONTEXT`;
- `RESET`;
- `BACK`.

Если action не меняет `state_hash`, новый history entry не создаётся. `RESET` возвращает canonical default и сохраняет предыдущее состояние только если оно действительно отличалось. `BACK` восстанавливает exact предыдущий canonical state и его hash.

History не входит в URL state и не превращается в permanent saved-view storage. Saved dashboards/versioning относятся к R8.

## URL-safe private-app state

`encodeState()` сериализует canonical state body как canonical JSON UTF-8 и кодирует его base64url с prefix `prh1.`. Ограничения:

- JSON не более 8192 bytes;
- encoded token не более 12000 chars;
- padding `=` отсутствует;
- decode повторно валидирует все VIZ/SCOPE contracts;
- decoded object обязан canonical re-encode в **тот же** token, иначе state отклоняется;
- history не сериализуется.

URL-state предназначен только для private Web App history/navigation. Он **не считается public-shareable ссылкой**. Даже без financial values filter IDs/values могут отражать приватную структуру категорий/счетов, поэтому публичная публикация URL state не допускается.

## Privacy boundary

Контракт рекурсивно отклоняет ключи финансового payload: datasets, rows, transactions, results, measures, amount fields, KPI amount fields и `scope_assignments`. Это защита от случайного превращения navigation state в переносчик финансового результата.

Public-safe telemetry содержит только:

- schema/version;
- action/decision/reason;
- `state_hash`;
- history depth;
- widget count;
- global `scope_id`;
- `drill_active`.

Filter values, widget filter contents, private IDs и финансовые значения в telemetry отсутствуют.

## Границы ответственности

ANL-074:

- не меняет FIN-TRUTH, KPI Dictionary или canonical transactions;
- не исполняет AnalyticsQuery;
- не меняет VIZ-020 FilterContext/DrillContext schemas;
- не меняет SCOPE-070 policy semantics;
- не реализует DASH-082 cross-filter event bus;
- не реализует DASH-083 drill-through UI;
- не реализует DASH-084 saved dashboards;
- не имеет storage/network/IO/financial-write/canonical-mutation authority;
- использует synthetic public evidence;
- соблюдает `FREE_ONLY`.

## Проверка

Named gate `Exploration state model` запускает `tests/exploration_state_contract_test.js`. Тесты проверяют upstream parity, order independence, INCLUDE intersection, EXCLUDE union, contradiction fail-closed, scope inherit/override, effective drill composition, no-op history, reset/back, bounded history, canonical state hash, URL round-trip/tamper/oversize, financial-payload rejection и privacy-safe telemetry.
