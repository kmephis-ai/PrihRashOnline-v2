# DASH-086 — безопасный импорт и экспорт конфигурации dashboard

## Назначение

`PRH_DASHBOARD_PORTABLE_SPEC_V1@1.0.0` задаёт переносимый JSON-контракт для конфигурации пользовательского dashboard. Его задача — перенести layout, canonical query configuration, semantic bindings и visual customization между приватными пользовательскими окружениями, **не превращая экспорт в выгрузку финансовых данных** и не создавая новый storage/write authority.

DASH-086 завершает R8 portability boundary. Он опирается на уже канонические:

- DASH-080 `PRH_DASHBOARD_COMPOSER_V1@1.0.0`;
- DASH-081 `PRH_WIDGET_FACTORY_V1@1.0.0`;
- DASH-084 `PRH_DASHBOARD_SAVED_VIEWS_V1@1.0.0`;
- DASH-085 `PRH_DASHBOARD_VISUAL_CUSTOMIZATION_V1@1.0.0`;
- SEC-002;
- `FIN-TRUTH-v1`.

Portable layer не переопределяет ни один из этих contracts.

## Private configuration, а не public artifact

Portable JSON имеет privacy class `PRIVATE_CONFIGURATION` и machine warning `PRIVATE_CONFIGURATION_NOT_PUBLIC_SAFE`.

Экспорт **может содержать приватные configuration identifiers**, например category/account/filter/query IDs внутри canonical AnalyticsQuery. Поэтому файл предназначен для переноса владельцем между доверенными приватными окружениями и не считается public-safe только потому, что в нём нет сумм.

Human warning является частью manifest:

> Экспорт может содержать приватные идентификаторы запросов, фильтров и измерений. Не публикуйте portable JSON как public artifact.

Public GitHub tests используют только synthetic identifiers.

## Что разрешено переносить

Payload содержит только:

1. canonical DASH-084 saved configuration:
   - DASH-080 `DashboardSpec`;
   - отдельно валидированные DASH-081 bound widget descriptors;
2. zero-or-more DASH-085 visual customization descriptors, привязанных только к существующим bound widgets.

Derived hashes upstream contracts **не считаются доверенными данными импорта**. Layout, binding, query и customization identities пересчитываются существующими canonical validators.

## Что запрещено

Portable payload рекурсивно отклоняет:

- `AnalyticsResult`, result rows и любые result snapshots;
- canonical transaction rows/datasets;
- amounts, balances, KPI/measure output values и другие финансовые результаты;
- OAuth/access/refresh/id tokens, credentials, passwords, API keys и secrets;
- Apps Script/spreadsheet/deployment IDs и private runtime locators/URLs;
- arbitrary URL, CSS, HTML, JavaScript, executable code, formatter/callback/function payload;
- prototype-pollution keys `__proto__`, `prototype`, `constructor`.

DASH-086 не является механизмом резервного копирования финансовой базы.

## Envelope и identity

Current envelope schema = `PRH_DASHBOARD_PORTABLE_SPEC_V1`.

Он содержит:

- `manifest` с contract-version provenance и privacy warning;
- canonical `payload`;
- `payload_hash`;
- bounded counts;
- `portable_hash`;
- `checksum` вида `sha256:<portable_hash>`.

Canonical serialization сортирует object keys. Timestamp отсутствует и не участвует в identity. Эквивалентная конфигурация при другом порядке ключей должна давать тот же `payload_hash`, `portable_hash` и canonical bytes.

`created_by` фиксирует версии portable, saved-view, visual-customization, composer и widget-factory contracts. Это provenance, а не runtime locator.

## Bounded transport

V1 использует fail-closed limits:

- portable JSON: не более 64 KiB;
- JSON nesting depth: не более 32;
- отдельная строка: не более 8192 символов;
- widgets: не более 48;
- bindings: не более 48;
- customization descriptors: не более 48.

Лимит widgets согласован с canonical DASH-080 `max_widgets=48`, поэтому portability не создаёт более узкую скрытую semantic capacity, но всё равно остаётся bounded.

## Checksum-before-semantics

Import выполняет проверки в следующем порядке:

1. bounded JSON parsing;
2. duplicate/prototype key rejection;
3. exact envelope shape/version;
4. checksum/identity verification над **полученным raw payload**;
5. только затем semantic normalization через DASH-084/DASH-080/DASH-081/DASH-085;
6. counts/canonical re-export identity verification.

Это означает, что случайно или намеренно повреждённый файл не проходит дальше как доверенная semantic configuration.

Даже корректно пересчитанный внешним источником checksum не даёт права подменить upstream derived identities: imported `binding_hash`, query identity, layout identity и customization compatibility проверяются/пересчитываются canonical validators.

## Safe JSON parser

DASH-086 не использует импортированный JSON как executable object graph. Bounded parser:

- отслеживает максимальную глубину;
- ограничивает общий размер и длину строк;
- обнаруживает duplicate object keys до их потери обычным `JSON.parse`;
- блокирует prototype-pollution keys;
- не вызывает `eval`, `Function`, renderer callback или импортированный formatter.

Unknown/future schema fail closed и не downgrade’ится автоматически.

## Validation-only import

Core import возвращает `PRH_DASHBOARD_PORTABLE_IMPORT_RESULT_V1` со следующими обязательными properties:

- `status=VALID` только после полного contract validation;
- `decision=DRY_RUN_ONLY`;
- `persistence_performed=false`;
- `persistence_authority=false`;
- `persistence_requires=DASH-084_SAVED_VIEW_LIFECYCLE_EXPLICIT_CALL`.

То есть успешный импорт **не сохраняет dashboard автоматически**.

Для persistence вызывающий private runtime обязан отдельным явным действием использовать существующий DASH-084 lifecycle/storage adapter со всеми его generation checks, revision/view limits и UserProperties boundary. DASH-086 не вызывает `PropertiesService`, `SpreadsheetApp`, `UrlFetchApp`, `setProperties()` или financial write API.

Partial mutation из portable core невозможна.

## DASH-085 visual customization

Каждый portable customization descriptor содержит только:

- schema/version;
- `widget_id`;
- canonical DASH-085 customization configuration.

При export/import descriptor должен ссылаться на существующий DASH-081 bound widget. Затем выполняется `DASH-085 applyCustomization()` для соответствующего binding.

Это сохраняет VIZ-070 query-hash invariant и не позволяет portable layer превратить presentation preference в query mutation.

## Legacy migration

V1 поддерживает только явно объявленный legacy schema `PRH_DASHBOARD_PORTABLE_SPEC_V0@0.9.0`.

Migration:

1. валидирует legacy exact shape и hostile-payload boundary;
2. преобразует layout/bindings/customizations в current upstream contracts;
3. строит canonical V1 envelope;
4. возвращает `PRH_DASHBOARD_PORTABLE_MIGRATION_V1` с source hash, target portable hash и deterministic migration hash;
5. остаётся dry-run и ничего не сохраняет.

Unknown/future legacy version fail closed.

## Round-trip invariant

После успешного V1 import повторный canonical export обязан дать byte-identical portable envelope. Это доказывает, что import не вносит скрытых semantic transforms и object key ordering не становится source of truth.

Для migrated V0 input target V1 envelope также детерминирован; migration receipt фиксирует source/target identity chain.

## Privacy-safe telemetry

Telemetry allowlist содержит только:

- schema;
- version;
- action;
- `payload_hash_prefix`;
- `byte_count`;
- `widget_count`;
- `binding_count`;
- `customization_count`;
- decision;
- reason.

Telemetry не содержит:

- dashboard/widget names;
- raw widget IDs;
- query/filter values;
- category/account/member/project IDs;
- financial values;
- transaction IDs;
- runtime locators;
- secrets.

## Authority boundary

Все DASH-086 authority = false:

- financial truth/write;
- query execution/mutation;
- binding/canonical mutation;
- authorization;
- storage/persistence;
- network;
- deployment;
- renderer.

`FREE_ONLY` обязателен. External SaaS/CDN/paid provider для import/export не требуется.

## Machine evidence

`tests/dashboard_safe_import_export_contract_test.js` проверяет:

- deterministic current V1 round-trip;
- object-key order invariance;
- checksum mismatch before semantic processing;
- re-checksummed but semantically tampered derived binding identity rejection;
- duplicate JSON key rejection;
- prototype-pollution rejection;
- max bytes/depth/string/count limits;
- hostile financial/result/secret/runtime/executable payload rejection;
- upstream layout/binding/customization validation parity;
- deterministic V0 -> V1 migration;
- dry-run/no-persistence boundary;
- privacy-safe telemetry;
- отсутствие platform storage/network APIs в portable core.

Required named gate: `Dashboard safe import/export`.

Existing DASH-085..080/PRIV/STUDIO/VIZ/DESIGN/ANL/FIN/MIG/privacy/security/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

## Rollback

Rollback DASH-086 удаляет portable contract/core/tests/docs/gate. DASH-084 saved views и DASH-085 visual customization остаются canonical; пользовательская private configuration и financial data не требуют migration/rollback mutation.
