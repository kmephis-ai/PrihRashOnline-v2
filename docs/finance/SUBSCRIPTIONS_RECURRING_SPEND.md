# Выявление подписок и регулярных расходов — SUB-030

## Назначение

`SUB-030` добавляет `PRH_SUBSCRIPTION_DETECTION_V1@1.0.0` — deterministic precision-first слой, который ищет повторяющиеся **проведённые расходы** и формирует объяснимые кандидаты для пользовательской проверки.

Кандидат не является финансовым фактом, новой транзакцией или обязательством. Детектор не пишет в Google Sheets, не создаёт `PRH_OBLIGATION_PLAN_V1` автоматически и не получает financial-write authority.

## Что допускается к анализу

В detector входят только canonical transactions:

- `type = expense`;
- `status = posted`;
- есть явный `counterparty` либо `description`.

`income`, `transfer`, `refund`, `adjustment`, а также `pending` и `void` не являются occurrence подписки. Это намеренно консервативно: возврат не должен выглядеть как новый платёж, а pending-операция — как подтверждённая регулярность.

## Signature без fuzzy matching

Для группировки используется `PRH_SUBSCRIPTION_SIGNATURE_V1`.

Label берётся сначала из `counterparty`, при отсутствии — из `description`. Нормализация ограничена техническими преобразованиями `NFKC → trim → collapse whitespace → lowercase`. Токены не удаляются, слова не переставляются, similarity/Levenshtein/LLM matching отсутствуют.

Группа определяется одновременно по:

- normalized label;
- currency;
- `account_id`;
- `category_id`.

`signature_hash` — SHA-256 от versioned schema и canonical JSON этих полей. Raw label, account/category IDs и суммы разрешены во внутреннем private finding, но запрещены в public telemetry.

## Cadence evidence

V1 поддерживает только две cadence:

### WEEKLY

Ожидаемый интервал — 7 дней, допуск — ±1 день. Все интервалы между последовательными occurrence обязаны укладываться в допуск.

### MONTHLY

Каждая следующая occurrence должна находиться в следующем календарном месяце. Nominal day определяется как максимальный наблюдаемый day-of-month; для короткого месяца он clamp-ится к последнему дню. Допуск day-of-month — 3 дня. Эта модель детерминированно обрабатывает последовательности вроде 31 января → 28 февраля → 31 марта → 30 апреля без RRULE/fuzzy semantics.

Минимум для кандидата — 3 occurrence. В одной группе учитываются максимум последние 24 occurrence и не более 730 дней истории. Более старая история отбрасывается детерминированно, а finding помечается `history_truncated=true`.

## Amount stability

Сумма — только detection feature, не новый FIN-TRUTH показатель.

Reference = lower median в integer minor units. Допуск = максимум из:

- 100 minor units;
- floor(5% reference), то есть 500 basis points.

Все occurrence обязаны находиться внутри допуска. Если cadence стабильна, а сумма нет, результат остаётся `REVIEW`; детектор не сглаживает дрейф и не подменяет реальные значения.

## Состояния finding

- `CANDIDATE` — cadence и amount stability доказаны;
- `REVIEW` — наблюдений достаточно, но cadence или amount evidence неоднозначны;
- `NO_CANDIDATE` — недостаточно occurrence; такие группы не входят в итоговый findings list, но учитываются в rejected count;
- `ALREADY_TRACKED` — только если caller явно связал `signature_hash` с существующим `plan_id` и plan проходит exact checks.

Любой новый `CANDIDATE` остаётся `review_required=true`. `auto_confirmed=false`, `obligation_created=false`, `canonical_mutation=false`, `financial_write=false`.

## Сравнение с OBL-020

Автоматического сопоставления по названию plan нет. Единственный допустимый механизм — явный `PRH_SUBSCRIPTION_OBLIGATION_LINK_V1`:

`signature_hash → plan_id`.

После этого дополнительно проверяются:

- plan существует и имеет direction `OUTFLOW`;
- currency совпадает;
- WEEKLY/MONTHLY cadence совпадает с interval=1;
- plan amount **точно** равен detector reference amount.

Только тогда finding получает `ALREADY_TRACKED`. Даже это не меняет plan и transaction history.

## Privacy и observability

Public telemetry содержит только allowlisted technical metadata: schema/version/query hash, количества групп/candidates/review/already-tracked/rejected и cadence counts. В telemetry запрещены raw label, transaction ID, account/category ID и финансовые значения.

Все GitHub tests используют independently generated synthetic transactions. Реальные семейные labels, операции и агрегаты не публикуются.

## Границы

`PRH_SUBSCRIPTION_DETECTION_V1` не получает authority для FIN-TRUTH, canonical transaction, obligation plan, storage, network, deployment или financial write. `FREE_ONLY` обязателен; внешняя ML/LLM/bank API зависимость не требуется. Generic Google write остаётся заблокирован `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`, а исторический `IRREVERSIBLE_ACTION_AUTHORIZED` не переиспользуется.
