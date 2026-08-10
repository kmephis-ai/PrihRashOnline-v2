# BAL-030 — снимки остатков и объяснимая сверка

`PRH_BALANCE_RECONCILIATION_V1@1.0.0` вводит отдельный planning/finance-domain слой для датированных наблюдений остатка по счёту. Его задача — ответить на узкий вопрос: согласуется ли явно наблюдаемый остаток с изменениями, которые следуют из канонической истории операций между двумя точками наблюдения. Этот слой не изменяет `FIN-TRUTH-v1`, не создаёт новый источник canonical transactions и не получает права записи.

## Почему нужен anchor observation

Из потока доходов, расходов и переводов нельзя восстановить абсолютный остаток счёта, если неизвестен хотя бы один реальный или явно объявленный исходный остаток. Поэтому BAL-030 запрещает неявное предположение «счёт начинался с нуля».

Для каждой сверки обязательны два наблюдения одного счёта и одной валюты:

- **anchor observation** — исходный подписанный остаток на точный RFC3339-момент;
- **target observation** — наблюдаемый остаток на более поздний момент.

Расчётный остаток определяется только как:

`anchor balance + canonical account deltas после anchor и до target включительно`.

Если anchor отсутствует, счёт/валюта различаются или target не позже anchor, вычисление завершается fail-closed. BAL-030 не пытается угадать opening balance.

## Balance observation

`PRH_BALANCE_OBSERVATION_V1` содержит:

- opaque `observation_id`;
- `account_id`;
- ISO currency;
- точный `observed_at`;
- signed safe-integer `balance_minor`;
- provenance наблюдения: source system, source record identity/fingerprint, capture method и transform version.

Поддерживаются capture methods `MANUAL_DECLARED`, `STATEMENT_DECLARED` и `SYNTHETIC_TEST`. Наблюдение не является canonical transaction. Сам факт наличия observation также не означает, что он автоматически подтверждён банком: provenance обязан сохранять происхождение.

## Как canonical transaction меняет конкретный счёт

BAL-030 использует действующую `PRH_CANONICAL_TRANSACTION_V1` и `FIN-TRUTH-v1`, но переводит household-level semantics в account-level delta:

- posted income на счёт: `+amount`;
- posted expense со счёта: `-amount`;
- posted refund на счёт: `+amount`;
- transfer: `-amount` для source account и `+amount` для destination account;
- current adjustment: только zero amount, поэтому delta равен нулю;
- pending и void не участвуют.

Это не противоречит transfer-neutral household cash flow: перевод не меняет деньги семьи в целом, но изменяет два отдельных счёта. Если операция касается сверяемого счёта, но имеет другую валюту, BAL-030 не конвертирует её молча и завершает вычисление fail-closed. FX остаётся отдельным Roadmap item.

Временной интервал строго `ANCHOR_EXCLUSIVE_TARGET_INCLUSIVE`: операция в точности на timestamp anchor не учитывается, а операция в точности на timestamp target учитывается.

## Результат сверки

`PRH_BALANCE_RECONCILIATION_RESULT_V1` хранит private-result значения:

- canonical delta;
- calculated balance;
- observed target balance;
- mismatch = `observed - calculated`;
- `MATCH` или `MISMATCH`;
- deterministic reconciliation id;
- количество проверенных и реально включённых операций;
- provenance применённых canonical/FIN policies.

Повтор того же нормализованного входа даёт тот же reconciliation id и тот же результат. Порядок входного массива операций не влияет на идентичность: перед расчётом relevant transactions сортируются детерминированно.

## Mismatch не разрешает исправление данных

При `MISMATCH` BAL-030 создаёт только proposal `REVIEW_CANONICAL_OR_OBSERVATION`. Он означает: нужно проверить пропущенную/ошибочную операцию, момент observation либо само observation. Proposal всегда содержит:

- `mutation_authorized=false`;
- `canonical_mutation=false`;
- `observation_mutation=false`;
- `financial_write=false`.

BAL-030 никогда автоматически не добавляет «корректирующую» транзакцию и не переписывает историю. Исторический `IRREVERSIBLE_ACTION_AUTHORIZED` не переиспользуется; generic Google canonical write по-прежнему требует отдельную policy и остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Privacy и telemetry

Public repository содержит только независимо созданные synthetic fixtures. `PRH_BALANCE_RECONCILIATION_TELEMETRY_V1` разрешает только технические поля: schema/version, state/reason, transaction counts, направление canonical delta и тип proposal. В public telemetry запрещены balances, mismatch amount, raw account/observation IDs и другой financial payload.

Реальные observations, реальные рассчитанные остатки и reconciliation details должны оставаться в private runtime/storage boundary. BAL-030 сам не реализует storage, bank API, UI cutover или network provider.

## FREE_ONLY и границы scope

BAL-030 не требует платного API, внешнего банковского провайдера, модели или облачной инфраструктуры. `FREE_ONLY` обязателен.

В scope BAL-030 не входят Net Worth, FX conversion, live bank sync, автоматическая correction transaction, household risk model и изменение write ownership. Следующие слои могут использовать BAL-030 только через его versioned contract и не имеют права переопределять его provenance/exact-money semantics.

## Machine evidence

Named gate `Balance reconciliation` проверяет synthetic MATCH/MISMATCH, transfer source/destination semantics, pending exclusion, interval boundaries, signed balances, deterministic rerun, safe-integer overflow, duplicate canonical identity, currency/account mismatch, telemetry privacy и отсутствие runtime/write APIs. Полный fail-closed suite дополнительно должен сохранить DATA/FIN/MIG/GOAL/PROJ/TREND/AI/privacy/FREE_ONLY/UI/PWA gates зелёными до trusted exact-SHA delivery и Main Verification.
