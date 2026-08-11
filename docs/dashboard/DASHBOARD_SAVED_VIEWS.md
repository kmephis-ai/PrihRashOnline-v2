# DASH-084 — Saved views, presets и dashboard versions

## Назначение

`PRH_DASHBOARD_SAVED_VIEWS_V1@1.0.0` добавляет приватное сохранение конфигурации Analytics Studio без сохранения финансового dataset. Saved view хранит только versioned layout/query/presentation configuration и историю её изменений.

DASH-084 переиспользует два upstream authority:

- `PRH_DASHBOARD_COMPOSER_V1@1.0.0` — canonical DashboardSpec/layout identity;
- `PRH_WIDGET_FACTORY_V1@1.0.0` — semantic binding/query/presentation identity.

Saved-view layer не имеет права пересчитывать layout, переписывать AnalyticsQuery или вычислять FIN-TRUTH самостоятельно.

## Private storage boundary

Runtime persistence = Apps Script `PropertiesService.getUserProperties()`.

Не используются:

- financial Google Sheets;
- `ScriptProperties`;
- `DocumentProperties`;
- browser `localStorage/sessionStorage` как required persistence;
- external DB/SaaS;
- платный сервис.

Причина: dashboard view — private user configuration, а не canonical financial record. Хранение её отдельно исключает accidental financial-write authority и не требует миграции основной базы.

Adapter `DashboardSavedViewsStorageService.js` использует namespaced keys:

- `PRH_DASH084_V1:INDEX`;
- `PRH_DASH084_V1:VIEW:<view_id>`.

Index содержит только generation и отсортированный список view IDs. Каждый view хранится отдельным JSON document. Delete записывает tombstone и одновременно обновляет index одним `setProperties()` batch, поэтому logical state не зависит от отдельного remove operation.

Любой commit проходит под `LockService.getUserLock()` и сравнивает `expected_generation`. Stale writer получает `DASH084_STORAGE_GENERATION_CONFLICT`; overwrite без re-read запрещён.

## Bounded persistence

Machine limits намеренно консервативны:

- до 24 saved views;
- до 6 immutable revisions на view;
- до 7 KB canonical configuration;
- до 8 KB serialized view document;
- до 6 KB index.

Проверка выполняется до storage mutation. Это fail-closed boundary: приложение не должно рассчитывать на platform quota error как на механизм контроля роста.

## Saved configuration

`PRH_DASHBOARD_SAVED_CONFIGURATION_V1` содержит:

1. canonical DASH-080 `PRH_DASHBOARD_SPEC_V1`;
2. zero-or-more отдельных `PRH_DASHBOARD_BOUND_WIDGET_V1` из DASH-081.

Semantic bindings не внедряются внутрь DASH-080 layout spec. Layout identity и binding identity остаются upstream-derived и перепроверяются при каждом normalize/read.

Каждый bound widget обязан существовать в saved layout. Duplicate/missing widget binding fail closed.

## Что запрещено сохранять

Saved documents не являются data cache. Guard запрещает, в частности:

- `AnalyticsResult`/result rows;
- transaction rows/datasets;
- calculated output values (`value_minor`, `actual_total_minor`, `balance_minor`, `income_minor`, `expense_minor`, `cash_flow_minor` и т. п.);
- OAuth/access/refresh tokens;
- credentials/secrets;
- private deployment/runtime locators.

При этом canonical **query configuration** разрешена, включая private dimension/filter IDs, потому что storage является private per-user boundary. Эти значения не допускаются в telemetry/public evidence.

## Revision model

`PRH_DASHBOARD_SAVED_VIEW_REVISION_V1` immutable и содержит:

- sequential revision number;
- source operation;
- parent revision hash;
- canonical saved configuration;
- configuration hash;
- revision hash.

Timestamp не входит в canonical identity. Одинаковая конфигурация при `SAVE_VERSION` возвращает `NOOP` и не расходует generation/history slot.

### CREATE

Создаёт revision 1.

### SAVE_VERSION

Если configuration hash изменился — добавляет следующую revision. Старые revisions не переписываются.

### CLONE

Создаёт новый view ID и только revision 1 из **текущей** source configuration. История source view не копируется. Для provenance сохраняется source revision hash как parent reference.

### RENAME

Меняет только view metadata/generation. Revision history остаётся byte-equivalent.

### RESTORE_REVISION

Не перемещает active pointer назад. Выбранная старая configuration добавляется как новая revision с source `RESTORE_REVISION`.

### RESET

Если view создан из preset — добавляется revision с актуальным canonical preset baseline. Для обычного view baseline = revision 1. Если baseline уже активен, operation = `NOOP`.

### DELETE

Удаляет view из logical store. Runtime adapter записывает tombstone + новый index одним batch; финансовые данные никогда не затрагиваются.

## Migration

DASH-084 определяет явный legacy schema `PRH_DASHBOARD_SAVED_VIEW_V0` только как migration fixture/contract.

`MIGRATE` принимает строго известную legacy форму и создаёт current view с одной revision `MIGRATE` и `PRH_DASHBOARD_SAVED_VIEW_MIGRATION_V1` receipt. Unknown/future schema fail closed — автоматического угадывания формата нет.

Migration относится только к dashboard configuration и не использует MIG-010 financial write authority.

## Curated presets

Catalog содержит восемь editable/cloneable presets:

- `FAMILY`;
- `EXPENSE`;
- `INCOME`;
- `CASH_FLOW`;
- `BUDGET`;
- `NET_WORTH`;
- `RISK`;
- `SUBSCRIPTIONS`.

В DASH-084 это безопасные starter layouts с тематическими placeholders. Presets намеренно не содержат financial snapshots и не притворяются источником аналитических результатов. Более богатые expert presets с advanced analytics остаются отдельным DASH-090/R9 scope.

Preset можно клонировать в private saved view и затем редактировать/bind через уже существующие DASH-080/DASH-081 contracts.

## Deterministic identity

Canonical hashing = `SHA256_CANONICAL_JSON_V1`.

Hash не зависит от порядка object keys. Upstream layout/binding normalizers выполняются до saved-view hashing. В identity не входят wall-clock timestamp, browser instance или runtime locator.

Store использует optimistic integer generation. Любая applied mutation увеличивает generation ровно на 1; NOOP не увеличивает generation.

## Telemetry и privacy

Telemetry allowlist:

- `schema`;
- `version`;
- `action`;
- `view_hash_prefix`;
- `revision_hash_prefix`;
- `view_count`;
- `revision_count`;
- `decision`;
- `reason`.

В telemetry отсутствуют:

- view name;
- preset title;
- AnalyticsQuery/filter values;
- account/category/member/project IDs;
- amounts/KPI values;
- transaction IDs;
- runtime locators.

Public repository evidence = independently generated synthetic/configuration-only.

## Authority

`dashboard_config_storage=true` означает только право сохранять private dashboard configuration в namespaced user properties.

Остальные authority остаются false:

- `financial_truth`;
- `financial_write`;
- `query_execution`;
- `query_mutation`;
- `canonical_financial_mutation`;
- `authorization`;
- `network`;
- `deployment`;
- `renderer`;
- `layout`.

## Тестирование

`tests/dashboard_saved_views_contract_test.js` проверяет:

- create/version/noop;
- clone/rename/reset/restore/delete;
- immutable revision chain;
- revision/generation limits;
- all eight presets;
- V0 -> V1 migration;
- DASH-080/DASH-081 normalization parity;
- private query IDs allowed only as configuration;
- financial/result/secret payload rejection;
- telemetry privacy;
- fake Apps Script `UserProperties` read/write;
- user lock + stale generation conflict;
- single `setProperties()` batch;
- tombstone delete;
- byte-limit rejection before persistence.

Required named gate: `Dashboard saved views`.

Existing DASH-083/DASH-082/DASH-081/PRIV/STUDIO/VIZ/ANL/TX/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

## Rollback

Rollback DASH-084 удаляет contracts/core/runtime adapter/tests/docs/gates. Namespaced `PRH_DASH084_V1:*` properties содержат только dashboard config и могут быть удалены независимо; canonical financial data и DASH-080..083 остаются неизменными.
