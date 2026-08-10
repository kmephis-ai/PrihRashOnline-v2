# NW-030 — Net Worth с явной provenance

`PRH_NET_WORTH_V1@1.0.0` вводит versioned снимок чистого капитала семьи поверх уже завершённого BAL-030. Его задача — собрать на одну дату счета, явно оценённые активы и явно оценённые обязательства так, чтобы источник каждого значения оставался видимым и проверяемым.

## Одна дата и одна валюта

Каждый `PRH_NET_WORTH_SNAPSHOT_V1` имеет `valuation_date` и presentation currency. Все позиции snapshot обязаны иметь ту же дату и ту же валюту. Смешивание RUB/USD/EUR внутри одного результата завершается fail-closed: NW-030 не выполняет скрытую конвертацию и не требует внешнего FX provider. Исторические/текущие курсы относятся к отдельному FX-030.

NW-030 также не интерполирует стоимость между датами. Если позиция не оценена на выбранную valuation date, она не должна молча переноситься как будто это актуальная оценка.

## Account positions только через BAL-030

Счёт не принимает произвольное число как «остаток». Account position создаётся из:

- `PRH_BALANCE_OBSERVATION_V1` — source `OBSERVED_BALANCE`;
- `PRH_BALANCE_RECONCILIATION_RESULT_V1` — явный source `OBSERVED_BALANCE` либо `CALCULATED_BALANCE`.

Если BAL-030 вернул `MISMATCH`, NW-030 не скрывает его. Пользователь/верхний слой обязан явно выбрать observed или calculated значение, а position provenance сохраняет reconciliation id и state. Сам Net Worth получает status `RECONCILIATION_REVIEW_REQUIRED`, пока хотя бы одна account position несёт mismatch provenance.

Это позволяет drill/reconciliation позже показать, почему один и тот же счёт мог иметь observed и calculated варианты, не подменяя один другим.

## Non-account assets и liabilities

Активы и обязательства вне account balance задаются как положительные exact safe-integer minor-unit valuations. Их provenance сообщает source kind и source fingerprint. Baseline допускает `DECLARED_VALUE` и `SYNTHETIC_TEST`; live market price provider не требуется и не является скрытой зависимостью.

Значение non-account position не является canonical transaction и не меняет `FIN-TRUTH-v1`. Это valuation layer, поэтому result provenance явно содержит `financial_truth=false`.

## Формула

Net Worth рассчитывается детерминированно:

`sum(signed account balances) + sum(declared assets) - sum(declared liabilities)`.

Для explainability дополнительно публикуются gross assets и gross liabilities. Положительный account balance относится к gross assets. Отрицательный account balance сохраняется signed в основной формуле и его абсолютное значение относится к gross liabilities.

Все суммы используют safe-integer exact-money arithmetic; overflow завершает вычисление fail-closed.

## Determinism и identity

Positions нормализуются и сортируются детерминированно. Duplicate position id запрещён. Два account positions одного `account_id` в одном snapshot также запрещены, чтобы один счёт нельзя было случайно посчитать дважды.

`net_worth_id` строится из SHA-256 нормализованного snapshot. Перестановка positions во входном массиве не меняет snapshot identity или результат. Input objects не мутируются.

## Privacy

Private result может содержать labels, account references и financial values, но public telemetry — нет. `PRH_NET_WORTH_TELEMETRY_V1` содержит только counts, source-kind counts, mismatch count и status. В public GitHub разрешены только независимо созданные synthetic fixtures.

## Safety boundaries

NW-030 не имеет authority для:

- canonical mutation;
- balance observation mutation;
- financial write;
- FX conversion;
- market-data network access;
- storage/runtime/deployment changes.

Исторический `IRREVERSIBLE_ACTION_AUTHORIZED` остаётся exact-bound/non-reusable. Generic Google canonical write по-прежнему fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. `FREE_ONLY` обязателен.

## Machine evidence

Named gate `Net Worth` проверяет observed/calculated BAL provenance, MISMATCH visibility, exact totals, signed negative account balance, deterministic ordering, duplicate account/position protection, mixed-currency/date fail-closed, overflow, telemetry privacy и отсутствие runtime/write APIs. Полный layered suite должен сохранить BAL/DATA/FIN/MIG/GOAL/PROJ/TREND/AI/privacy/FREE_ONLY/UI/PWA gates зелёными до trusted exact-SHA delivery и Main Verification.
