# DASH-080 — Responsive Grid Dashboard Composer

## Назначение

`PRH_DASHBOARD_COMPOSER_V1@1.0.0` — configuration-only конструктор макета Analytics Studio. Он определяет положение и размеры placeholder-виджетов, но **не** определяет финансовые показатели, запросы, графики или фильтры.

DASH-080 отделяет геометрию дашборда от semantic analytics. Каждый виджет имеет `semantic_binding_status=UNBOUND`; подключение `AnalyticsQuery`, `ChartSpec` и KPI относится к следующему Roadmap item `DASH-081`.

## Границы authority

Composer не имеет прав:

- вычислять FIN-TRUTH или KPI;
- читать private financial runtime;
- выполнять или изменять AnalyticsQuery;
- связывать placeholder с semantic measure/dimension;
- изменять canonical transactions;
- выполнять financial write;
- выдавать authorization;
- обращаться к network/storage/deployment;
- сохранять dashboard в persistent storage.

Все соответствующие поля authority равны `false`. `FREE_ONLY` обязателен.

## Versioned schemas

Основной contract: `PRH_DASHBOARD_COMPOSER_V1@1.0.0`.

Dashboard spec: `PRH_DASHBOARD_SPEC_V1`.

Placeholder widget: `PRH_DASHBOARD_PLACEHOLDER_WIDGET_V1`.

Widget содержит только:

- `schema`;
- стабильный `id` формата `w-0001`;
- короткий `title`;
- `semantic_binding_status=UNBOUND`;
- geometry `x/y/w/h`.

Financial values, transaction rows, query/filter payload, ChartSpec и private dimension identifiers запрещены fail-closed.

## Canonical desktop grid

Desktop использует 12 колонок и bounded height. Geometry задаётся целыми `x/y/w/h`.

Нормализация выполняется детерминированно:

1. requested widgets сортируются по `requested_y`, затем `requested_x`, затем `widget_id`;
2. размер ограничивается versioned min/max;
3. если requested position валиден и свободен, он сохраняется;
4. при overlap или выходе position за границы применяется canonical row-major first-fit;
5. если свободного места нет, результат `DASH080_GRID_CAPACITY_EXHAUSTED`; тихое удаление widget запрещено.

Одинаковый набор widget specs даёт одинаковый canonical layout независимо от порядка элементов входного массива.

## Layout identity

Identity строится как `FNV1A32_CANONICAL_JSON_V1` поверх canonical JSON без derived `layout_identity`.

`layout_identity` является derived metadata: повторная canonicalization принимает существующее значение, игнорирует его и пересчитывает. Это позволяет безопасно применять операции к предыдущему canonical result без доверия к переданному hash.

## Операции

Поддерживаются только:

- `ADD`;
- `MOVE`;
- `RESIZE`;
- `DUPLICATE`;
- `REMOVE`;
- `RESET`.

Операции immutable: исходный spec не мутируется. Unknown fields и forbidden payload fail-closed.

`ADD` и `DUPLICATE` создают следующий стабильный widget ID. `DUPLICATE` копирует только configuration metadata и geometry; semantic binding остаётся `UNBOUND`.

`RESET` возвращает versioned default session layout.

## Responsive derivation

Responsive layouts вычисляются из canonical desktop spec и не сохраняются как отдельный source of truth.

### DESKTOP

12-column canonical repaired layout.

### TABLET

6-column deterministic row-major repack. Ширина derived widget = bounded `ceil(desktop_width / 2)`. Все виджеты сохраняются.

### MOBILE

Одна колонка. Виджеты образуют canonical stack в desktop row-major order; `x=0`, `w=1`, `y` является накопленной высотой предыдущих widgets.

Ни на одном viewport нельзя silently drop widget.

## Live Studio workspace

`surface=composer` — отдельная opt-in Web App поверхность. Она:

- не входит в primary Daily/R2 navigation;
- открывается из Studio;
- не вызывает private financial runtime;
- не использует `google.script.run`;
- не использует `localStorage` или `sessionStorage`;
- держит dashboard state только в памяти текущей страницы;
- показывает только placeholder widgets.

Browser API `PRH_DASHBOARD_COMPOSER` предоставляет configuration-only `getState`, `getLayout`, `applyOperation`, `reset`.

Persistent saved dashboards и version history относятся к `DASH-084`.

## Доступность

Widget container имеет `role=region` и accessible label. Controls имеют отдельные accessible names для move/resize/duplicate/remove. Toolbar buttons работают стандартной keyboard activation. Focus-visible сохраняется, reduced motion учитывается.

DOM order соответствует canonical row-major order, поэтому keyboard/screen-reader последовательность остаётся детерминированной.

## Тесты

`dashboard_composer_contract_test.js` проверяет:

- contract/authority;
- repeat canonicalization;
- input-order invariance;
- collision/out-of-bounds repair;
- capacity fail-closed;
- ADD/MOVE/RESIZE/DUPLICATE/REMOVE/RESET;
- stable IDs;
- responsive derivation;
- forbidden payload;
- privacy-safe telemetry.

`dashboard_composer_runtime_contract_test.js` проверяет opt-in router/Studio integration и `privateReads=0` для composer/Studio.

`dashboard_composer_visual_test.js` на 1440×900, 768×1024 и 390×844 прогоняет реальные UI-операции, сравнивает browser state с Node core по layout identity, проверяет keyboard activation, `UNBOUND`, `SESSION_ONLY` и отсутствие horizontal overflow.

Required named gates:

- `Dashboard composer`;
- `Dashboard composer visual gate`.

## Observability

Telemetry содержит только `schema/version/action/widget_count/layout_hash_prefix/viewport_class/decision/reason`.

Financial values, private IDs, query/filter payload в telemetry запрещены.

## Rollback

Откат DASH-080 удаляет composer contracts/core/runtime surface/tests/docs/Studio affordance. STUDIO-080, PRIV-080, VIZ-070 и canonical Financial Home остаются без изменений.
