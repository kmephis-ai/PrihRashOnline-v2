# DASH-090 — Expert dashboard gallery

`DASH-090` вводит `PRH_EXPERT_DASHBOARD_GALLERY_V1@1.0.0` — неизменяемый каталог экспертных шаблонов поверх уже существующего жизненного цикла сохранённых дашбордов `DASH-084`. Gallery не является новым dashboard engine, не хранит пользовательские данные и не вычисляет финансовую истину. Она отвечает только за безопасный набор готовых конфигурационных входов: название, объяснение назначения, требования к capability/version и ссылки на уже канонические аналитические или X-Ray контракты.

## Почему выбран именно такой слой

До DASH-090 проект уже имеет `DASH-080` layout/composer, `DASH-081` semantic bindings, `DASH-084` private saved views/version history, визуальные контракты и отдельные аналитические движки. Создание второго persistence/query/render стека ради галереи породило бы две конкурирующие истины и увеличило риск расхождения FIN-TRUTH. Поэтому gallery остаётся тонким каталогом. При действии **«Создать копию»** она передаёт configuration в существующий DASH-084 lifecycle; последующие rename/save/version/restore выполняются только его API.

Такой вариант совместим с дальнейшим развитием: новый экспертный preset добавляется как новый immutable descriptor с explicit `source_contract` и required capability. Существующие пользовательские копии не зависят от будущего изменения каталога. Rollback удаляет gallery contract/catalog/UI integration; DASH-084 views и финансовые данные не требуют миграции или восстановления.

## Семь базовых экспертных шаблонов

Каталог имеет стабильный порядок и identity hash:

1. `CASH_FLOW_DECOMPOSITION` — декомпозиция денежного потока через `PRH_CONTRIBUTION_DECOMPOSITION_V1`.
2. `SPENDING_DRIVERS` — драйверы и распределение расходов через decomposition + seasonality/distribution/concentration contracts.
3. `SEASONALITY` — сезонные профили и распределения через `PRH_SEASONALITY_DISTRIBUTION_CONCENTRATION_V1`.
4. `CONCENTRATION` — концентрация расходов и доходов через тот же canonical concentration layer.
5. `LONG_TERM_TRENDS` — долгосрочная динамика через `PRH_LONG_TERM_TRENDS_V1`.
6. `WEALTH_RISK` — конфигурация капитала и сценарных рисков через DASH-084 + `PRH_LIQUIDITY_FINANCIAL_RISK_V1`.
7. `FINANCIAL_HEALTH_XRAY` — typed findings и drill metadata только из `PRH_FINANCIAL_HEALTH_XRAY_V1`.

X-Ray preset принципиально **не содержит собственных правил**. Gallery может только сослаться на уже вычисленный typed finding/drill contract. Severity, threshold, evidence и missing-data semantics остаются ответственностью XRAY-090.

## Целевой пользовательский вид

Gallery является первым явно выровненным с `docs/dashboard/TARGET_DASHBOARD_EXPERIENCE.md` presentation surface. Основная пользовательская поверхность должна выглядеть как зрелая часть PrihRash, а не как contract browser: сильная визуальная иерархия, понятный аналитический вопрос, visual structure preview без финансовых значений и человеческие статусы. `required_capabilities`, `source_contract`, storage/version internals и другие developer details остаются доступны только через progressive technical disclosure.

Preview показывает только форму будущего dashboard — например decomposition, динамику, структуру, сезонность или signals — и не содержит synthetic/fake household values. После `Создать копию` пользователь попадает в dashboard-like canvas + inspector, но persistence, versioning и semantic authority по-прежнему принадлежат существующим DASH-080/081/084 контрактам. Это presentation improvement, а не второй renderer/query/storage engine.

## Capability fail-closed

Каждый preset содержит versioned `required_capabilities`. Для открытия/клонирования все они должны быть `AVAILABLE`. `DEGRADED`, `UNAVAILABLE`, отсутствующий или неизвестный capability не заменяется синтетическим финансовым результатом: preset получает `UNAVAILABLE / REQUIRED_CAPABILITY_NOT_AVAILABLE`.

Это позволяет безопасно обновлять ADWF/PrihRash и отдельные аналитические модули: gallery не предполагает, что наличие файла означает совместимость. Проверяется конкретный contract/version, а несовместимый будущий major должен быть явно добавлен новым изменением DASH-090.

## Приватность и FIN-TRUTH

Public catalog содержит только configuration metadata, IDs самих presets, contract/version refs и presentation intent. В нём запрещены `AnalyticsResult`, transaction rows, финансовые значения, private dimension/filter IDs, runtime locators, credentials и secrets. Пользовательские private filters могут появляться только после создания личной DASH-084 копии.

Gallery не имеет authority для financial truth, financial writes, query execution/query mutation, network, deployment, storage или authorization. Warm gallery interaction не требует обязательного сетевого/Google Sheets read. `FREE_ONLY` сохраняется.

## Clone lifecycle

`cloneToSavedView()` сначала проверяет required capabilities. Затем строит lossless configuration projection в существующем `PRH_DASHBOARD_SPEC_V1`: каждый expert panel получает canonical DASH-080 placeholder geometry, а `dashboard_spec.id` содержит versioned immutable ссылку `expert-v1-<preset>`. Сами `source_contract`/`semantic_ref` не копируются в финансовый payload и восстанавливаются только из неизменяемого public catalog. Конфигурация сохраняется через `DASH-084 createView`; отдельного storage key, revision chain или migration format нет.

DASH-081 остаётся единственным canonical semantic-binding contract после clone/edit. Public preset намеренно не подделывает `PRH_ANALYTICS_QUERY_V1` для advanced/X-Ray/Risk semantics и поэтому сохраняет placeholders как `UNBOUND`, пока private user context не сможет дать валидный explicit binding. Это fail-closed handoff, а не второй binding engine: DASH-090 явно требует exact `DASH-080`/`DASH-081` capability versions и не создаёт собственную query/binding schema.

После clone пользователь открывает личную копию прямо из Gallery, меняет допустимую configuration-only часть (сейчас название dashboard), сохраняет новую DASH-084 revision и после reload получает ту же expert preset identity. Catalog original остаётся immutable. UserProperties — единственный persistence boundary; Google Sheets и FIN-TRUTH этим путём не читаются и не изменяются.

## Проверки

`tests/expert_dashboard_gallery_contract_test.js` доказывает:

- полный стабильный каталог 7 presets и deterministic hashes;
- отсутствие duplicate IDs и неизвестных capability refs;
- fail-closed availability при degraded/unknown capability;
- отсутствие financial/private payload в catalog и telemetry;
- clone через существующий DASH-084 lifecycle;
- сохранение DASH-084 NOOP/version/rename semantics после clone;
- отсутствие собственной финансовой/query/storage authority;
- X-Ray preset только ссылается на canonical XRAY contract.

Provider PR Validation выполняет named contract gate `Expert dashboard gallery` и отдельный `Expert dashboard gallery visual gate`. Browser gate доказывает desktop+mobile keyboard flow: Gallery → `Создать копию` → открыть private copy → изменить название → сохранить новую version → reload, без horizontal overflow, console/page errors и без дополнительных browser network requests на warm clone/edit path в synthetic runtime harness. Exact-head trusted deploy/runtime и fresh Product Ready E2E остаются обязательными до DONE.
