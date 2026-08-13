# FIN-REC-001 — private Расходы / Доходы / Денежный поток

## Назначение

`FIN-REC-001` подключает три пользовательских финансовых раздела canonical R2 Web App к реальным private read-only данным. Финансовая истина остаётся в canonical FIN-TRUTH / EXP-020 / INC-020 / CF-020; Web App не получает права записи и не вводит собственные финансовые формулы.

## Общий runtime

Каждый запрос раздела использует один immutable canonical snapshot. Клиент передаёт активный `section`, период и bounded account/category/member filters. Сервер строит ровно один соответствующий analytics view: `Расходы`, `Доходы` или `Денежный поток`. Остальные два view в этом запросе не вычисляются.

Owner UAT развернутого exact candidate `1e994fe790f43c5480e917a2e8d4b9a626fa14f1` подтвердил повторный performance FAIL: графики появляются через **10–15 секунд**. Этот runtime candidate не может получить Product Ready.

Второй performance rework ограничивает вход canonical analytics только двумя равными окнами, реально необходимыми экрану: текущим периодом и периодом сравнения. Более старые операции не передаются в многократные daily-trend расчёты, но остаются частью canonical snapshot и общей source revision. FIN-TRUTH не меняется: денежные значения по-прежнему вычисляют canonical analytics modules.

Runtime telemetry содержит только безопасные технические метрики: `snapshot_elapsed_ms`, `analytics_elapsed_ms`, `total_elapsed_ms`, `analytics_input_record_count` и `analytics_scope_days`. Денежные значения, private labels и identifiers в telemetry отсутствуют.

## Product truth

Product Ready, merge и Main Verification остаются заблокированы. После полного PR Validation и trusted exact-SHA deployment нового candidate требуется свежий owner UAT на компьютере и телефоне. UAT предыдущего SHA на новый candidate не переносится.

## Ограничения

- read-only: canonical financial writes отсутствуют;
- `NORMAL` показывает private данные только владельцу;
- `MASKED` не выполняет analytics build;
- `DEMO` / `ZEN` для private FIN routes fail closed;
- FREE_ONLY; внешний платный provider не требуется;
- stale source revision блокирует routed drill вместо смешивания разных snapshots.
