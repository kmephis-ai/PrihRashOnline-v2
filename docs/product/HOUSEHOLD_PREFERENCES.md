# PROF-020 — Household / Preferences Center

## Назначение

`PRH_HOUSEHOLD_PREFERENCES_V1@1.0.0` задаёт отдельный configuration domain для семейного профиля, профилей участников и пользовательских интерфейсных предпочтений. Этот слой не является частью финансовой истины: он не хранит суммы, операции, счета, категории или KPI и не меняет `FIN-TRUTH-v1` / `PRH_CANONICAL_TRANSACTION_V1`.

PROF-020 использует существующие DESIGN-020 и AUTH-040 как upstream authorities. Он не создаёт параллельную систему тем, ролей или разрешений.

## Preferences

Поддерживаются:

- theme: `SYSTEM`, `LIGHT`, `DARK`; `LIGHT/DARK` должны оставаться совместимыми с `PRH_DESIGN_SYSTEM_V1@1.0.0`;
- density: `COMFORTABLE`, `COMPACT`;
- locale: только `ru-RU` в текущем LANG-RU baseline;
- reduced motion: `SYSTEM`, `REDUCE`, `NO_PREFERENCE`;
- high contrast preference: `SYSTEM`, `MORE`, `NO_PREFERENCE`;
- text scale: от `0.90` до `1.30` с шагом `0.05`;
- default landing zone: HOME, TRANSACTIONS, EXPENSES, INCOME, CASH_FLOW, BUDGET, OBLIGATIONS или DATA_QUALITY.

Все значения нормализуются детерминированно; unknown enum, неверный диапазон или неподдерживаемый шаг отклоняются fail-closed.

## Household и members

Household содержит только opaque ID и display name. Member содержит opaque ID, display name, role, state и preferences. Public evidence использует только независимо созданные synthetic values.

Допустимые роли не определяются PROF-020 самостоятельно: exact set `OWNER|EDITOR|VIEWER` сверяется с `PRH_FAMILY_AUTH_V1@1.0.0`. Должен оставаться хотя бы один ACTIVE OWNER; duplicate member ID запрещён.

## Mutation planning, но не mutation execution

`planMutation()` отвечает только на вопрос «какая capability требуется». Он не проверяет session/token, не выдаёт capability и не выполняет запись.

- собственный профиль и preferences → `PROFILE_EDIT`;
- household profile, другой member, role/membership → `HOUSEHOLD_ADMIN`.

Каждый plan содержит `authorization_granted=false`, `mutation_executed=false`, `financial_write=false`. Реальная авторизация принадлежит AUTH-040. Storage adapter в PROF-020 отсутствует.

## Accessibility

DESIGN-020 остаётся authority design tokens/accessibility. PROF-020 хранит preference, а не переопределяет рендерер. `reduced_motion` должен применяться через существующий reduced-motion design boundary; theme LIGHT/DARK — через существующие design themes. `SYSTEM` означает следовать окружению клиента, а не создавать третью theme definition.

## Privacy

Configuration serialization предназначен для private app configuration и не является public sharing format. Public telemetry не содержит raw household/member ID или display names. `telemetry()` требует injected HMAC key не короче 32 bytes и публикует только allowlisted technical metadata и hashes.

Financial payload, private runtime locator, scope assignment overlay и credential-like configuration не входят в PROF-020 contract. Existing repository privacy/secret scans остаются обязательными.

## Стоимость и runtime

PROF-020 не требует внешнего SaaS, IdP provisioning, network service или платного API. `FREE_ONLY` mandatory. Current private Apps Script Web App остаётся `MYSELF`; PROF-020 не меняет public exposure.

## Machine gate

Named gate `Household preferences` выполняет `tests/household_preferences_contract_test.js`. Test проверяет defaults, deterministic ordering/serialization, DESIGN/AUTH upstream parity, invalid enums/ranges, role/owner invariants, planner capability mapping, отсутствие authorization/write authority и privacy-safe telemetry.

Gate классифицируется как `PURE_DOMAIN_APPLICATION`, потому что implementation не зависит от Apps Script, DOM, network или storage.

## Definition of Done

PROF-020 считается завершённым только после green named gate, LANG-RU/Documentation truth, AUTH/DESIGN/FIN/MIG/full layered/UI/PWA regressions, immutable exact candidate, Trusted DEV Deploy, Trusted Runtime Health, CI-003 autonomous merge и Main Verification.
