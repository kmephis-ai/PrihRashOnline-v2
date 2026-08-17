# ADR-MIG-010 — occurrence-aware identity для owner-confirmed одинаковых операций

- Статус: Accepted for MIG-010 candidate
- Roadmap: MIG-010
- Canonical schema: `PRH_CANONICAL_TRANSACTION_V1`
- Identity strategy: `CONTENT_FINGERPRINT_OCCURRENCE_V1`
- Write authority: false

## Контекст

DATA-001 использует `CONTENT_FINGERPRINT_V1`, когда legacy source не предоставляет stable external record ID. Это корректно для обычного импорта: row position не входит в identity, поэтому перемещение строки не меняет logical source record.

Owner-private MIG-010 dry-run обнаружил класс `SOURCE_DUPLICATE`. Owner resolution может подтвердить `PRESERVE_ALL`: одинаковые по canonical core source rows являются разными реальными операциями и ни одна из них не должна быть удалена как duplicate resubmission.

Обычный `CONTENT_FINGERPRINT_V1` не может представить такой случай: одинаковый content даёт одинаковый `source_record_id`, а collection validator правильно блокирует duplicate logical source identity. Использовать изменённые суммы/даты/описания для искусственного различения финансовых событий запрещено. Использовать mutable `source_position` как общий canonical identity также запрещено.

## Решение

Добавить в Canonical Transaction v1 новую versioned strategy:

`CONTENT_FINGERPRINT_OCCURRENCE_V1`

Стратегия активируется только в MIG-010 repair resolution после явного owner decision `PRESERVE_ALL` для конкретной duplicate group.

Для группы с одинаковым `source_fingerprint`:

1. исходный content fingerprint остаётся неизменным;
2. members упорядочиваются детерминированно по source row внутри exact owner-private snapshot;
3. каждому member назначается `occurrence_ordinal = 1..N`;
4. `source_record_id` = fingerprint + occurrence ordinal;
5. canonical `transaction_id` детерминирован из fingerprint + occurrence ordinal;
6. `source_position` остаётся отдельным mutable locator;
7. финансовые core fields не изменяются.

Повторный resolve на том же source snapshot и owner resolution обязан возвращать тот же resolved hash и те же canonical IDs.

## Почему schema_version остаётся 1

Top-level shape, required fields, money/type/status semantics и provenance shape не меняются. Изменяется только versioned enum `identity_strategy`. Старые `EXTERNAL_ID` и `CONTENT_FINGERPRINT_V1` остаются валидными и семантически неизменными.

Поэтому это backward-compatible capability extension `PRH_CANONICAL_TRANSACTION_V1`, а не schema v2.

## Почему не использовать source row как identity

`source_position` является locator, а не identity. Row insertion/movement не должна сама по себе менять canonical transaction identity.

Occurrence ordinal не публикуется как универсальная identity source sheet. Он применяется только к owner-confirmed группе одинакового fingerprint в exact migration snapshot. Если состав группы меняется, source revision/repair proposal меняются и старое resolution не должно автоматически применяться.

## Safety

- AI/CI не могут выбирать `PRESERVE_ALL`.
- `SOURCE_DUPLICATE` без owner resolution остаётся fail-closed.
- `UNRESOLVED` остаётся BLOCKED.
- occurrence strategy не создаёт write authority.
- repair tool по-прежнему отклоняет `execute/write/apply`.
- first real write требует отдельный `IRREVERSIBLE_ACTION_AUTHORIZED`, свежий DR-001 backup, exact rebuild hash, readback/reconciliation и rollback path.
- public CI использует только synthetic duplicate fixtures.

## Последствия

Положительные:

- подтверждённые одинаковые реальные операции не теряются;
- FIN-TRUTH учитывает каждую occurrence;
- canonical collection сохраняет уникальные transaction/source identities;
- исходный content fingerprint остаётся аудируемым;
- обычный DATA-001 path не меняется.

Ограничения:

- occurrence identity предназначена для migration repair, а не для автоматического duplicate detection;
- изменение состава duplicate group требует нового proposal/resolution;
- реальная migration остаётся policy-gated и не разрешается этим ADR.
