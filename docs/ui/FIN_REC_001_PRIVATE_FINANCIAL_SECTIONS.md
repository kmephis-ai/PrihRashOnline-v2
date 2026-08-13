# FIN-REC-001 — private Расходы / Доходы / Денежный поток

## Назначение

`FIN-REC-001` подключает три пользовательских финансовых раздела canonical R2 Web App к реальным private read-only данным. Финансовая истина остаётся в canonical `FIN-TRUTH-v1`: денежные меры проходят через `PRH_ANALYTICS_CONTRACT_V1` → KPI Dictionary → Financial Reconciliation. Web App не получает права записи и не вводит собственные финансовые формулы.

## Общий runtime

Каждый запрос раздела использует один immutable canonical snapshot и exact source revision. Клиент передаёт активный `section`, период и bounded account/category/member filters. `MASKED` не выполняет финансовую аналитику; `DEMO` / `ZEN` для private FIN routes fail closed.

## Owner performance evidence

Exact deployed candidate `2a28bdb70e27a91b0728ec2384dd102c55bd8bce`, Apps Script version `206`, прошёл technical runtime health, но свежий owner UAT дал:

- `Расходы` — около **8 секунд** до появления графиков;
- `Доходы` — около **11 секунд**;
- `Денежный поток` — около **15 секунд**.

Это **Product UAT performance FAIL**. Candidate `2a28bdb70e27a91b0728ec2384dd102c55bd8bce` не получает Product Ready и не может быть merged как пользовательски готовый.

## Performance rework v3 — canonical analytics fast path

Предыдущие rework уже устранили расчёт сразу трёх разделов и ограничили вход двумя нужными периодами, но specialized EXP/INC/CF builders всё ещё строили дневной trend через повторный проход по одному и тому же набору операций для каждого дня. Это оставляло алгоритмический паттерн порядка `days × transactions`.

Runtime v3 убирает этот паттерн без переноса финансовых формул в UI:

1. Источник по-прежнему читается один раз через approved single-scan snapshot.
2. Для выбранного раздела выполняются ровно **две** bounded canonical analytics queries через `source.cycle.analytics(...)`.
3. Первая query группирует текущий период по `DAY` за один проход canonical Analytics Contract.
4. Вторая query строит текущий/previous-period comparison; для `Расходов` и `Доходов` — по canonical `category_id`, для `Денежного потока` — scalar FIN measures.
5. Runtime только собирает уже рассчитанные canonical measures в пользовательский view и проверяет parity/invariants. Собственных денежных формул и write authority не появляется.
6. Specialized `EXP-020` / `INC-020` / `CF-020` modules остаются regression/parity reference: contract test сравнивает числовой результат fast path с прежними canonical builders.

Таким образом дневной график больше не требует полного повторного сканирования входа для каждой точки. Количество canonical analytics queries на один раздел фиксировано и не растёт вместе с количеством дней.

## Observability

Runtime telemetry содержит только privacy-safe технические метрики: `snapshot_elapsed_ms`, `analytics_elapsed_ms`, `total_elapsed_ms`, `analytics_input_record_count`, `analytics_scope_days`, `analytics_query_count`, `analytics_runtime_authority`. Денежные значения, private labels и identifiers в telemetry отсутствуют.

## Product truth

Product Ready, merge и Main Verification остаются заблокированы. Для rework v3 требуется полный PR Validation нового exact SHA, затем trusted exact-SHA deployment + authenticated runtime health и только после этого новый owner UAT на компьютере и телефоне. UAT предыдущих SHA на новый candidate не переносится.

## Ограничения

- read-only: canonical financial writes отсутствуют;
- `NORMAL` показывает private данные только владельцу;
- `MASKED` не выполняет analytics queries;
- `DEMO` / `ZEN` для private FIN routes fail closed;
- FREE_ONLY; внешний платный provider не требуется;
- stale source revision блокирует routed drill вместо смешивания разных snapshots.
