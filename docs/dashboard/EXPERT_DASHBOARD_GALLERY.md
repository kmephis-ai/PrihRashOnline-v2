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

## Capability fail-closed

Каждый preset содержит versioned `required_capabilities`. Для открытия/клонирования все они должны быть `AVAILABLE`. `DEGRADED`, `UNAVAILABLE`, отсутствующий или неизвестный capability не заменяется синтетическим финансовым результатом: preset получает `UNAVAILABLE / REQUIRED_CAPABILITY_NOT_AVAILABLE`.

Это позволяет безопасно обновлять ADWF/PrihRash и отдельные аналитические модули: gallery не предполагает, что наличие файла означает совместимость. Проверяется конкретный contract/version, а несовместимый будущий major должен быть явно добавлен новым изменением DASH-090.

## Приватность и FIN-TRUTH

Public catalog содержит только configuration metadata, IDs самих presets, contract/version refs и presentation intent. В нём запрещены `AnalyticsResult`, transaction rows, финансовые значения, private dimension/filter IDs, runtime locators, credentials и secrets. Пользовательские private filters могут появляться только после создания личной DASH-084 копии.

Gallery не имеет authority для financial truth, financial writes, query execution/query mutation, network, deployment, storage или authorization. Warm gallery interaction не требует обязательного сетевого/Google Sheets read. `FREE_ONLY` сохраняется.

## Clone lifecycle

`cloneToSavedView()` сначала проверяет required capabilities. Затем берёт только configuration ближайшего canonical DASH-084 preset и вызывает `DASH-084 createView`. Gallery не добавляет собственный storage key, revision chain или migration format. После clone действуют существующие DASH-084 optimistic generation, immutable revisions, bounded history и private UserProperties semantics.

Catalog original остаётся immutable. Изменение копии никогда не меняет preset hash или descriptor.

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

Provider PR Validation должен выполнять named gate `Expert dashboard gallery`. Product/browser evidence добавляется в рамках того же DASH-090 writer до перехода в Product Ready/DONE; наличие только pure-domain PASS не является достаточным основанием объявлять DASH-090 завершённым.
