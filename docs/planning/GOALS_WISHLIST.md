# GOAL-030 — Goals & Wish-list

## Назначение

`PRH_GOAL_PLANNING_V1@1.0.0` задаёт отдельный planning domain для целей и wish-list: target, deadline, priority/status, declared funding history, progress и объяснимая recommendation.

Goal planning не является `FIN-TRUTH-v1`. До отдельного binding work item сумма накопления на цель не выводится автоматически из canonical account balance или transaction history. Funding history имеет явный provenance `DECLARED_PLANNING` и означает только то, что пользователь/приватный runtime объявил это событие как состояние планирования.

## Goal spec

Goal содержит:

- opaque `goal_id`;
- private display name;
- positive target в integer minor units;
- currency в трёхбуквенном uppercase формате;
- optional deadline `YYYY-MM-DD`;
- priority `P1..P5`;
- status `ACTIVE|PAUSED|ACHIEVED|CANCELLED`;
- funding events.

Goal input является private configuration. Public CI использует только independently generated synthetic goals.

## Funding history

Каждый `PRH_GOAL_FUNDING_EVENT_V1` содержит уникальный opaque event ID, дату, non-zero signed delta в minor units и обязательный provenance `DECLARED_PLANNING`.

Events сортируются по `occurred_on`, затем `event_id`; duplicate event ID запрещён. Negative event используется только как явная correction. Если deterministic cumulative funding становится отрицательным, evaluation fail-closed. Event позже explicit `as_of` запрещён: future plan не должен выглядеть как уже состоявшееся funding evidence.

Declared funding event **не является canonical transaction** и не даёт финансовой write authority.

## Progress

`evaluateGoal(goal, as_of)` вычисляет exact planning state:

- declared funded total;
- remaining amount = `max(target-funded, 0)`;
- overfunded amount = `max(funded-target, 0)`;
- progress basis points, capped `0..10000`;
- deadline state: `NO_DEADLINE|OVERDUE|DUE_TODAY|FUTURE`;
- calendar days remaining;
- contribution periods: inclusive current calendar month through deadline month.

Никакие KPI, budget actuals или forecast values при этом не пересчитываются.

## Explainable recommendation

Recommendation — `DETERMINISTIC_RULE`, не ML/forecast. Reason codes:

- `GOAL_FUNDED` — target уже покрыт declared funding;
- `ACTIVE_ON_TRACK_INPUT_REQUIRED` — active goal с deadline; выдаётся required monthly contribution;
- `OVERDUE` — deadline прошёл, target не покрыт;
- `NO_DEADLINE` — нельзя корректно вычислить monthly requirement без deadline;
- `PAUSED` / `CANCELLED` — recommendation не предлагает contribution.

Для active goal с deadline required monthly contribution = `ceil(remaining / contribution_periods)`. Это planning recommendation, `financial_truth=false`, и она не использует PROJ-030 или скрытый forecast.

## BUD-020 boundary

Roadmap dependency BUD-020 означает, что Goals создаются после budget baseline. GOAL-030 не переопределяет budget semantics и не пишет budget/canonical data. Будущее связывание contribution recommendation с конкретным budget allocation требует отдельного явного contract/work item.

## Serialization и privacy

`serializeGoal()` детерминированно сериализует private goal configuration после нормализации/sort funding events. Это не public sharing format.

Public telemetry содержит только status, priority, наличие deadline, число funding events, deadline state, recommendation reason и coarse progress band. Goal name/ID, target/funded/remaining amounts и event deltas в telemetry отсутствуют.

## Authority и стоимость

GOAL-030 имеет `financial_truth=false`, `financial_write=false`, `canonical_mutation=false`, `budget_mutation=false`, `projection=false`, storage/network/runtime authority=false. `FREE_ONLY` mandatory.

## Machine gate

Named gate `Goals and wish-list` выполняет `tests/goal_planning_contract_test.js`. Тест покрывает deterministic event ordering, duplicate/idempotency boundary, negative correction, future event rejection, overfunding, deadline boundaries, inclusive contribution periods, ceil recommendation, invalid amount/currency/date/status/priority/provenance, input serialization и privacy-safe telemetry.

Gate относится к `PURE_DOMAIN_APPLICATION`.

## Definition of Done

GOAL-030 завершён только после green named gate, existing BUD/PROJ/TREND/FIN/MIG/analytics/profile/AI/LANG-RU/privacy/FREE_ONLY/full layered/UI/PWA regressions, immutable exact candidate, Trusted DEV Deploy, Trusted Runtime Health, CI-003 autonomous merge и Main Verification.
