# PLAN-REC-001 — Local-first Budget, Obligations и Liquidity

Статус: engineering implementation для `MASTER-GREC-5 / PLANNING-DATA-READY`. Product Ready требует exact-candidate machine E2E и отдельный owner UAT.

## 1. Owner authority

Владелец утвердил fail-closed модель источников:

- `03 Бюджеты` — Budget source; canonical v1 scenario = `Базовый`;
- scalar monthly budget берётся только из **явной общей строки периода**, где `Категория`, `Подкатегория` и `Проект` пусты;
- detail rows не суммируются автоматически; отсутствие общей строки означает `NOT_CONFIGURED`;
- `04 Регулярные` — source повторяющихся будущих `INFLOW/OUTFLOW`, только если тип и периодичность преобразуются без потери смысла;
- `05 Обязательства` — отдельный debt/commitment register; показывается только явно датированный платёж, recurrence из него не выводится;
- `06 Баланс` — отдельный source явных наблюдений остатков;
- Cash Flow никогда не используется как substitute balance; отсутствующее наблюдение = unknown, не zero.

Ни один planning flow не получает canonical financial write authority и не создаёт операции автоматически.

## 2. Почему planning snapshot отделён от transaction snapshot

Planning sheets могут измениться без изменения canonical transaction revision. Поэтому planning payload **не встраивается** в transaction `aggregates` и не использует transaction revision как собственный freshness token.

Используются два hash:

- `canonical_revision` — exact revision canonical transactions;
- `planning_revision` — SHA-256 нормализованного Budget/Recurring/Commitments/Balance source snapshot.

Browser хранит planning snapshot отдельно в `prihrash-local-planning-v1`, но принимает его для UI только когда `source.canonical_revision == active finance revision`. Несовпадение даёт честный `STALE`, а не смешивание ревизий.

## 3. Source adapter

`PlanningLocalFirstService.js` — read-only Apps Script adapter.

Он:

1. получает canonical snapshot через existing `prhR2DataCreateSnapshot_()`;
2. использует existing dimension/account resolver;
3. читает planning sheets bounded ranges;
4. нормализует только owner-approved semantics;
5. строит `PRH_LOCAL_PLANNING_SOURCE_V1`;
6. возвращает `FULL_SNAPSHOT` или `NOOP` по exact `planning_revision` + `canonical_revision`.

Private household amounts, labels and IDs остаются только в owner-private runtime payload. Public telemetry содержит только state/reason/count/timing.

### `06 Баланс`

Canonical header contract:

`ID | Дата и время | Счёт | Валюта | Остаток | Метод | Комментарий`

Разрешённые capture methods v1:

- `Ручной` / `MANUAL_DECLARED`;
- `Выписка` / `STATEMENT_DECLARED`.

Отсутствующий лист даёт `SETUP_REQUIRED`. Никакой computed balance вместо него не создаётся.

## 4. Local Worker path

`pwa/local_analytics_worker_entry.js` расширен message `PLANNING_QUERY`, но остаётся тем же canonical Worker без network/storage/write authority.

Planning engine переиспользует существующие доменные contracts:

- BUD-020 — `PRH_BUDGET_CONTROL_V1`;
- OBL-020 — `PRH_OBLIGATIONS_V1`;
- BAL-030 — `PRH_BALANCE_RECONCILIATION_V1`;
- фактические операции — `FIN-TRUTH-v1`.

Main UI не пересчитывает финансовые значения. Он только форматирует result Worker-а.

## 5. Browser runtime

`pwa/local_planning_runtime.js`:

- читает verified planning snapshot из отдельного IndexedDB cache;
- exact-bound к текущей finance revision;
- выполняет warm `budget / obligations / liquidity` query через existing Worker;
- не вызывает remote transport при обычном warm route switch;
- background refresh не является частью warm interaction SLA;
- source/network failure сохраняет прежний verified local planning snapshot как degraded read, если exact canonical binding остаётся валидным.

Planning runtime вообще не запускает remote planning sync на обычной finance/data route до первого входа в planning surface.

## 6. Product UI truth

SPA получает три routes:

- `Бюджет`;
- `Обязательства`;
- `Ликвидность`.

UI обязан показывать setup/configured/empty/unavailable states честно. В частности:

- Budget без explicit total не показывает synthetic total;
- Obligations явно сообщает, что plan не создаёт transaction;
- Liquidity без `06 Баланс` показывает инструкцию setup;
- observed total подписан как сумма **только наблюдаемых** счетов;
- BAL-030 reconciliation остаётся read-only diagnostic.

`MASKED/ZEN/DEMO` не раскрывают private numeric values.

## 7. Safety invariants

Запрещено:

- суммировать detail budget rows вместо owner total;
- выводить recurrence из `05 Обязательства`;
- считать missing balance равным нулю;
- использовать Cash Flow как balance;
- создавать canonical transaction из plan/commitment;
- делать Google Sheets read обязательным на каждый route switch;
- считать synthetic browser test заменой owner Product UAT.
- при неизвестном privacy mode fail-open в `NORMAL`; invalid mode обязан переходить в `MASKED`, а private planning labels не отображаются в `MASKED/DEMO/ZEN`.

`FREE_ONLY`, privacy, exact-SHA trusted delivery и existing Local-first performance gates сохраняются.

## 8. Evidence

Минимальный engineering evidence:

- `tests/local_planning_engine_contract_test.js`;
- `tests/planning_local_first_service_adapter_test.js`;
- `tests/local_planning_runtime_contract_test.js`;
- `tests/local_first_planning_spa_contract_test.js`;
- canonical Worker/runtime regressions;
- exact candidate real Chromium Product E2E desktop + representative mobile;
- Trusted Runtime Health проверяет private planning source внутри authenticated Apps Script execution: exact canonical revision, planning revision и no-write/no-inference flags; наружу выходит только scalar health result;
- no-write/privacy/packager tests.

Финальный `DONE` для `work_class=user_facing` требует fresh owner UAT exact deployed candidate и `product-ready-e2e=success`.
