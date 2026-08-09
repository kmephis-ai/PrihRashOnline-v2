# Transaction Repository Port v1

`roadmap_id: ARCH-011`  
`port: PRH_TRANSACTION_REPOSITORY_V1`  
`version: 1.0.0`

## Назначение

Transaction Repository Port отделяет pure application/domain core от конкретного storage backend. Все repository implementations работают с `PRH_CANONICAL_TRANSACTION_V1`; Google Sheet headers/ranges не являются domain API.

Machine contract: `lib/repository/transaction_repository.v1.json`.  
Common query/revision/fake implementation: `lib/repository/transaction_repository.js`.  
Google mapping adapter: `lib/adapters/google_sheets_transaction_repository.js`.  
Apps Script gateway: `GoogleTransactionRepositoryGateway.js`.

## Port capabilities

### Read

- `readAll()` — canonical transactions;
- `getById(transaction_id)` — один canonical record или `null`;
- `getRevision()` — deterministic technical revision внутри private process.

### Query

`query()` поддерживает explicit filters:

- transaction IDs;
- type/status;
- currency;
- account/category/member/project;
- any-of tags;
- explicit `[period_start, period_end)`;
- offset/limit, max 500.

Порядок детерминирован: `occurred_at ASC`, затем `transaction_id ASC`. UI/chart-specific sort semantics в port не встраиваются.

### Write interface

Port содержит `writeBatch()` contract, потому что будущие repository adapters должны иметь единый application boundary. Но **interface не равен authority**.

Generic write request требует:

- `idempotency_key`;
- `expected_revision`;
- bounded batch ≤100;
- canonical `PUT` operations.

Fake repository может выполнять synthetic writes только при explicit `synthetic_write_authority: true`, чтобы contract tests проверяли idempotency/stale revision/readback.

Current Google adapter всегда возвращает:

`GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`

и не исполняет canonical financial mutation.

## Google operations mapping v1

`lib/adapters/google_sheets_operations_mapping.v1.json` фиксирует текущий adapter mapping для `01 Операции`.

Required headers включают `ID`, `Дата и время`, `Тип`, `Сумма`, accounts/category/member/project/tags/source/status fields.

Правила:

- `ID` → stable canonical `transaction_id` + external source record ID;
- `Дата и время` → RFC3339 canonical timestamp;
- human type/status labels → explicit versioned enums;
- `Сумма` — source major units → exact integer minor units, максимум 2 decimal digits, rounding forbidden;
- currency не угадывается: explicit adapter config required;
- account/category/member/project labels требуют explicit resolver в stable canonical IDs;
- refund без reversal field maps to explicit `expense_reduction`;
- Google row number → `source_position` only, не logical identity;
- versioned projected row hash → private source fingerprint.

## Apps Script gateway

`GoogleTransactionRepositoryGateway.js` — единственное место ARCH-011, где нужен current Google Sheets runtime.

Internal `prhGoogleRepositoryReadOperationsTable_()` читает current table plain rows. Function заканчивается `_`, не предназначена как публичный finance-data Execution API endpoint.

Public-safe `prhGoogleRepositoryGatewayStatus()` возвращает только capability/version metadata и всегда сообщает `write_authorized: false`.

`prhGoogleRepositoryApplyCanonicalBatch_()` вызывает legacy operation write guard и затем независимо fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. В gateway отсутствуют `setValue/setValues/appendRow/deleteRow` operation-write primitives.

## Fake repository

`createFakeTransactionRepository()` используется локальными application/domain tests и будущими repository-independent service tests.

- read/query deterministic;
- revision не зависит от input order;
- synthetic write opt-in only;
- optimistic expected revision;
- idempotency receipt replay;
- canonical readback после write.

Fake data — independently generated synthetic only.

## Privacy

Repository revision/fingerprints могут быть производными от private data **внутри private runtime**, но реальные rows, revisions/fingerprints или aggregates не публикуются в GitHub evidence. Public CI использует только synthetic values/hashes.

## Handoff

ARCH-011 не выполняет full-history migration и не включает YDB. После его DONE становится dependency-ready MIG-010 P0, который должен использовать этот port + backup/idempotency/reconciliation contracts для deterministic full migration.
