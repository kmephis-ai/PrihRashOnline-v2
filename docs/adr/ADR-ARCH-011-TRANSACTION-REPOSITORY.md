# ADR ARCH-011 — Transaction Repository Port + Google Sheets Adapter

Статус: **Accepted for ARCH-011 candidate**  
Дата: 2026-08-09  
Roadmap: `ARCH-011`

## Контекст

R1 уже отделил финансовую семантику (`FIN-010`), portable canonical transaction (`DATA-010`) и pure application use-cases (`ARCH-010`). Следующая граница должна убрать Google Sheets layout/API из domain/application core и дать единый repository contract для текущего Google backend и будущих adapters.

Одновременно действующая safety policy запрещает считать наличие generic `write()` разрешением изменять canonical financial transactions. Current runtime остаётся read-only для `01 Операции`: `ALLOW_OPERATION_WRITES=false`, `automation_write_operations=false`, а dedicated financial mutation Roadmap contract ещё не реализован.

## Решение

1. Ввести versioned `PRH_TRANSACTION_REPOSITORY_V1` как storage-neutral port.
2. Query semantics — deterministic canonical filtering/order/paging над `PRH_CANONICAL_TRANSACTION_V1`.
3. In-memory fake полностью реализует read/query и synthetic-only write contract с optimistic revision + idempotency для local tests.
4. Google adapter разделить на:
   - platform-neutral mapping/repository adapter в `lib/adapters/**`;
   - Apps Script gateway `GoogleTransactionRepositoryGateway.js`, где разрешены Google-specific calls.
5. Current Google adapter предоставляет read/query и write interface, но canonical write всегда возвращает `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.
6. Apps Script gateway не содержит `setValue`, `setValues`, `appendRow`, `deleteRow` или иной operation-write primitive.
7. `source_position` остаётся mutable locator; Google row number не становится domain identity.
8. Mapping Google labels → stable canonical IDs выполняется explicit dimension resolvers; adapter не превращает human labels в неявные domain IDs.
9. Currency обязана приходить explicit adapter config, потому что текущая операция sheet не имеет canonical currency field.

## Почему не прямые Google calls в application core

Это связало бы FIN/DATA semantics с Apps Script и сорвало бы будущий fake/YDB adapter parity. Pure core должен оставаться локально тестируемым на Node и не иметь I/O authority.

## Почему Google write остаётся blocked

Repository architecture и mutation authorization — разные concerns. Для реального canonical write необходим отдельный contract: idempotency, preconditions/base revision, bounded scope, locks, audit identity, readback, reconciliation, backup/rollback и fail-closed partial handling. ARCH-011 не должен молча создавать такой authority.

## Последствия

Положительные:

- domain/application tests могут работать на fake repository;
- Google-specific mapping локализован;
- будущий YDB adapter сможет реализовать тот же port;
- migration/dual-read/shadow compare получают единый canonical boundary;
- accidental Google write path остаётся технически отсутствующим.

Ограничения:

- текущий Google adapter не выполняет canonical mutation;
- dimension resolver/config обязателен;
- full-history migration по-прежнему не завершена;
- performance/column-projection оптимизации выполняются отдельными PERF items.

## Verification

`tests/repository_adapter_contract_test.js` проверяет fake repository, query/revision/idempotency, Google mapping, synthetic Apps Script gateway integration, отсутствие write primitives и сохранение pure-core boundary.
