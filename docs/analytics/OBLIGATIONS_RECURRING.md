# OBL-020 — Obligations & recurring flows

## Назначение

`OBL-020` вводит `PRH_OBLIGATIONS_V1@1.0.0` — read-only planning model обязательств и повторяющихся потоков.

Это **не canonical transaction source** и не FIN-TRUTH. Плановая сумма и forecast показывают ожидаемое событие, но не превращаются в Income/Expense/Cash Flow до появления отдельной реальной canonical transaction по обычному data path.

## Planning window

Расчёт всегда выполняется в явном bounded окне `[window_start, window_end)`, а `as_of` находится внутри него.

Ограничения v1: максимум 366 дней; `UPCOMING` window = 30 дней после `as_of`; максимум 256 occurrences; максимум 128 plans. Явный `window_start` важен для overdue: система не скрывает неявный lookback.

## Plan v1

`PRH_OBLIGATION_PLAN_V1@1.0.0` содержит stable `plan_id`, label, direction `INFLOW`/`OUTFLOW`, non-negative integer `amount_minor` + currency, enabled flag, recurrence, optional `active_end_exclusive` и explicit `completed_due_dates`.

Amount/direction — planning metadata. Они не являются FIN-TRUTH и не записываются в canonical transaction автоматически.

## Recurrence v1

Поддерживаются только детерминированные правила:

- `ONCE`: exact `due_date`;
- `WEEKLY`: `anchor_date + N * interval_weeks * 7 days`, interval 1..52;
- `MONTHLY`: `anchor_date + N * interval_months`, interval 1..12.

Month-day policy строго `CLAMP_TO_LAST_DAY`. Для anchor 31 января последовательность включает 28 февраля 2026, 31 марта, 30 апреля; в leap year 2028 февральская дата = 29 февраля. Cron/RRULE/timezone/business-day shifting в v1 намеренно отсутствуют.

## Stable occurrence identity

`SHA256(PRH_OBLIGATION_OCCURRENCE_V1|PLAN_ID|DUE_DATE)`.

`source_position` не является identity authority.

## Completion

Завершение occurrence задаётся только explicit `completed_due_dates`. Completed due date обязана соответствовать recurrence rule; typo/non-occurrence fail-closed.

OBL-020 **не делает fuzzy transaction matching** по amount/description/date/counterparty и **не создаёт transaction автоматически**. Это исключает ошибочное объявление plan paid и двойную финансовую операцию.

## States

- `OVERDUE`: due date < as_of;
- `DUE`: due date == as_of;
- `UPCOMING`: due date > as_of и не дальше 30 дней;
- `FORECAST`: due date дальше 30 дней, но внутри planning window.

Disabled plan и occurrence после `active_end_exclusive` исключаются.

## Currency / totals

Один view v1 fail-closed при mixed currency. Planning totals по INFLOW/OUTFLOW допустимы как forecast metadata, но **не являются actual financial totals** и не могут сравниваться с FIN-010 без отдельного reconciliation/matching contract.

## Privacy / telemetry

Public tests/screenshots используют только independently generated synthetic plans. Public telemetry allowlist: schema/version, query hash, plan count, occurrence count, state counts, status/reason и bounded timing metadata. Amounts, labels, plan IDs и private financial details не входят в public telemetry.

## UI boundary

`ObligationsWebApp.html` — synthetic responsive evidence surface. Он явно сообщает: forecast ≠ fact; plan ≠ FIN-TRUTH; auto-create canonical transaction отсутствует. Private runtime route/persistence этим item не создаётся.

## Machine evidence

- `lib/obligations/obligations.v1.json`;
- `lib/obligations/obligations.js`;
- `tests/obligations_contract_test.js`;
- `ObligationsWebApp.html`;
- `tests/obligations_visual_test.js`;
- named gates `Obligations`, `Obligations visual gate`.

## Safety / rollback

OBL-020 не изменяет Google Sheets, `01 Операции`, canonical schema, FIN-TRUTH, BUD/CF/TX или write policy.

Rollback — revert OBL contract/core/UI/tests/docs/gates. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` остаётся non-reusable; any future financial mutation requires fresh explicit authorization/policy. `FREE_ONLY` обязателен.
