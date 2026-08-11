# PRIV-080 — режимы приватности представления

## Назначение

`PRH_PRIVACY_PRESENTATION_V1@1.0.0` задаёт единый pre-render слой приватности для canonical private Web App PrihRashOnline. Этот слой применяется **после** действующей авторизации и получения разрешённого presentation view, но **до** сериализации финансовых данных в HTML, таблицу или график.

Режим представления не является механизмом аутентификации или авторизации. `security_boundary=false`, `authorization_boundary=false`. Действующие границы `MYSELF`, PROF-020 и AUTH-040 не изменяются.

## Режимы

### NORMAL

Обычный private presentation. Уже авторизованный canonical view передаётся UI без изменения финансовой семантики. Это единственный режим, который может быть financial-truth presentation surface; финансовую истину по-прежнему определяют `FIN-TRUTH-v1` и KPI Dictionary, а не PRIV-080.

### MASKED

Режим безопасного просмотра рядом с другими людьми. До формирования HTML:

- monetary/value поля заменяются на `null`;
- account/category/member/project/transaction labels и identifiers удаляются;
- presentation arrays (`rows`, filters, chart series, mix arrays, widget lists и подобные контейнеры) fail-closed заменяются пустыми массивами;
- исходный canonical view не мутируется;
- UI получает уже отредактированный объект и не может восстановить исходные значения из DOM.

CSS blur, opacity, закрывающий overlay или форматирование числа не считаются privacy boundary и не являются доказательством MASKED.

### DEMO

Демонстрационный режим никогда не читает private financial runtime. Canonical router создаёт independently generated synthetic fixture с provenance `PUBLIC_SYNTHETIC`; `private_runtime_read=false`. Попытка передать private-source payload в DEMO завершается `PRIV080_DEMO_PRIVATE_SOURCE_FORBIDDEN`.

DEMO всегда явно маркируется как synthetic и `DEMO_SYNTHETIC_NOT_FIN_TRUTH`. Его суммы предназначены только для демонстрации интерфейса и не являются данными семьи или FIN-TRUTH.

### ZEN

Минимальный структурный режим. Private view может быть прочитан только server-side уже внутри авторизованного runtime, после чего pre-render policy удаляет amounts, transaction-level rows и частные измерения. В HTML передаётся отдельная safe structural page со статусом и разрешёнными техническими/структурными счётчиками. Financial Home payload в ZEN не сериализуется.

## Fail-closed правила

- Явно неизвестный `privacy` mode → `MASKED`.
- DEMO + private source → FAIL.
- Неизвестный source provenance → FAIL.
- Source object после transformation обязан остаться byte-equivalent по `JSON.stringify`; mutation → FAIL.
- Sensitive arrays удаляются целиком, даже если их parent key не был известен заранее. Это закрывает утечки через `filter_context.filters`, `visual_data.expense_mix`, `widgets`, `rows` и будущие массивные представления.
- Режим не выдаёт read/write/query/deployment authority.

## Browser preference

Preference schema: `PRH_PRIVACY_MODE_PREFERENCE_V1`.

Допустимы только:

- `schema`;
- `version`;
- `mode`.

Financial payload, query/filter context, private identifiers, tokens, credentials или runtime locators в preference запрещены. URL parameter `privacy` может явно переопределить browser preference для воспроизводимой server-side pre-render обработки.

## Canonical Web App integration

`CanonicalR2WebAppService.js` применяет PRIV-080 только к canonical Home path:

- NORMAL → canonical private runtime → unchanged presentation clone → Home;
- MASKED → canonical private runtime → pre-render redaction → Home;
- DEMO → synthetic fixture → Home, **без вызова private runtime**;
- ZEN → canonical private runtime server-side → structural redaction → отдельный safe page.

Legacy остаётся bounded rollback route и не получает новую privacy/security authority. PRIV-080 не изменяет financial writes, migration, canonical storage или FIN-TRUTH.

## Доказательства

`privacy_presentation_modes_contract_test.js` проверяет contract, preference, source isolation, nested secret injection, array redaction, source immutability и privacy-safe telemetry.

`privacy_presentation_runtime_contract_test.js` сравнивает Apps Script runtime adapter с Node reference contract и доказывает `DEMO privateReads=0`.

`privacy_presentation_modes_visual_test.js` проверяет MASKED/ZEN/DEMO на 1440×900, 768×1024 и 390×844. Secret tokens должны отсутствовать и в `innerText`, и в serialized DOM; DEMO обязан иметь явную synthetic label; horizontal overflow запрещён.

Required CI gates:

- `Privacy presentation modes`;
- `Privacy modes visual gate`;
- существующие privacy/security/FIN/MIG/FREE_ONLY/full layered/UI/PWA gates.

## Observability

Public-safe telemetry ограничена полями `schema/version/mode/source/decision/reason/field_count/suppressed_count/synthetic_only`. Финансовые значения, query/filter payload и private identifiers не публикуются.

## Rollback

Откат PRIV-080 удаляет presentation adapter, tests/docs/gates и selector. Canonical private Web App, `MYSELF`, FIN-TRUTH, storage и write ownership остаются без изменений.
