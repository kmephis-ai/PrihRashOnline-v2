# SCOPE-070 — области аналитики и системные теги

## Назначение

`PRH_ANALYTICS_SCOPE_V1@1.0.0` добавляет policy-слой между canonical dataset и `AnalyticsQuery`. Он позволяет явно выбрать аналитическое представление, например исключить отдельные операции из бытовой аналитики или показать только emergency-fund flows, **не изменяя canonical transactions и финансовую истину**.

`ALL_CANONICAL` всегда представляет исходный canonical dataset. Отфильтрованные scopes являются только аналитическими views. `FIN-TRUTH-v1`, KPI Dictionary, ANL-010 и ANL-070 не переопределяются.

## Почему системные теги отделены от user tags

Canonical поле `tags[]` остаётся свободным пользовательским пространством. Protected system tags не записываются туда и не получают authority через строковое совпадение.

Например, пользователь вправе создать обычный tag `EXCLUDE_FROM_ANALYSIS`. Сам по себе он ничего не исключает. Для системного поведения требуется отдельное private assignment overlay с protected tag ID.

Это предотвращает конфликт между пользовательской классификацией и policy semantics и не заставляет превращать `tags[]` в закрытый справочник.

## Protected system tags v1

- `EXCLUDE_FROM_ANALYSIS` — exclusion marker;
- `EMERGENCY_FUND` — inclusion/policy marker для emergency-fund scope.

Оба могут быть назначены на уровне `ACCOUNT` или `TRANSACTION`. Реестр versioned и может расширяться следующими Roadmap items, но неизвестный tag в v1 fail-closed.

## Assignment overlay

Private assignments имеют отдельную схему `PRH_ANALYTICS_SCOPE_ASSIGNMENTS_V1` и два уровня:

- account assignment связывает stable `account_id` с protected system tags;
- transaction assignment связывает exact stable `transaction_id` с protected system tags.

Account assignment применяется к операции, если account участвует как source `account_id` **или** как `destination_account_id`. Это важно для transfer flows: операция, переводящая средства в emergency account, должна попадать в emergency-fund view.

Unknown target, duplicate target, unknown system tag и duplicate tag отклоняются. Overlay не является public dashboard spec и по умолчанию считается private runtime metadata.

## Built-in scopes

### `ALL_CANONICAL`

Не содержит include/exclude policy и возвращает весь canonical dataset. Это контрольная точка: результат `evaluateScopedAnalytics(..., ALL_CANONICAL, query)` обязан совпадать с прямым `evaluateAnalytics(..., query)`.

### `DEFAULT_ANALYSIS`

Исключает операции, получившие protected `EXCLUDE_FROM_ANALYSIS` через transaction или account assignment.

### `EMERGENCY_FUND_ONLY`

Включает только операции с protected `EMERGENCY_FUND` через transaction/source-account/destination-account assignment и одновременно исключает `EXCLUDE_FROM_ANALYSIS`.

Если одна операция одновременно подходит под include и exclude, **deny wins**. Это исключает неявное восстановление скрытой операции через другой policy marker.

## Custom policy scopes

`PRH_ANALYTICS_SCOPE_SPEC_V1` содержит только:

- contract schema/version;
- stable `scope_id`;
- `include_any_system_tags`;
- `exclude_any_system_tags`.

В scope spec запрещены private transaction/account IDs, финансовые значения и assignment overlay. Include/exclude arrays canonicalized; unknown tags, duplicate tags, overlap и extra keys fail-closed. Built-in IDs нельзя переопределить другим набором правил.

Таким образом scope spec можно безопасно сохранять как reusable policy configuration, а private membership остаётся отдельно.

## Неизменность canonical truth

`applyAnalyticsScope()` сначала валидирует canonical collection, затем строит отдельный filtered array. Входные transactions, user tags и provenance не модифицируются.

SCOPE-070 не имеет canonical mutation или financial-write authority. Generic Google write по-прежнему заблокирован `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`, а historical `IRREVERSIBLE_ACTION_AUTHORIZED` не имеет отношения к scope filtering и не может переиспользоваться.

## Совместимость с аналитикой

`evaluateScopedAnalytics()` выполняет существующий ANL-010 `evaluateAnalytics()` над выбранным view. Scope layer не меняет `AnalyticsQuery`, KPI formulas, currency semantics, period semantics или semantic measure registry.

`ALL_CANONICAL` используется как parity proof. Отфильтрованный результат сохраняет provenance `FIN-TRUTH-v1`, но отражает **явно выбранный scope**, а не новую финансовую истину.

## Privacy-safe observability

Разрешённая telemetry содержит только schema/version, `scope_id`, decision/reason, protected system-tag IDs и included/excluded counts. Она не содержит account/transaction IDs, amount/currency, description/counterparty, provenance или private assignments.

## Границы SCOPE-070

SCOPE-070 не реализует:

- сохранение private assignments в конкретном backend;
- UI для редактирования tags/scopes;
- новые KPI или dimensions;
- period/comparison engine ANL-071;
- exploration state ANL-074;
- cloud replication/cutover;
- финансовые записи.

Storage adapter для private assignments может появиться отдельно, сохраняя этот pure contract и privacy boundary.

## Проверка

Named gate `Analytics scopes` запускает `tests/analytics_scope_contract_test.js`. Synthetic tests доказывают user-tag/system-tag separation, account source/destination semantics, transaction precedence, deny-wins, deterministic serialization, order independence, immutable canonical input, `ALL_CANONICAL` parity с ANL-010 и privacy-safe telemetry. `FREE_ONLY` обязателен.
