# Canonical Transaction Schema v1

`roadmap_id: DATA-010`  
`schema: PRH_CANONICAL_TRANSACTION_V1`  
`schema_version: 1`

## Назначение

Canonical Transaction v1 — portable domain record PrihRashOnline, не зависящий от Google Sheet headers, Dashboard layout или будущего storage adapter.

Machine-readable JSON Schema: `lib/domain/canonical_transaction.v1.schema.json`.  
Validator/compatibility layer: `lib/domain/canonical_transaction.js`.

## Обязательные поля

Каждая canonical transaction имеет явные поля:

- `transaction_id` — stable canonical ID;
- `occurred_at` — RFC3339 timestamp;
- `type` — `income | expense | transfer | refund | adjustment`;
- `status` — `posted | pending | void`;
- `amount_minor` — non-negative integer minor units;
- `currency` — explicit uppercase 3-letter code;
- `account_id`, `destination_account_id`;
- `category_id`, `member_id`, `project_id`, `tags`;
- `counterparty`, `description`;
- reversal fields;
- `provenance`.

Schema strict: unknown top-level/provenance fields требуют новой versioned schema или отдельного approved extension contract.

## Exact-money и KPI compatibility

DATA-010 не меняет FIN-TRUTH-v1 или KPI Dictionary v1.

- floating-point business money запрещён;
- transfer требует разные source/destination accounts и остаётся KPI-neutral;
- non-transfer не несёт destination account;
- refund требует `reverses_transaction_id` или explicit `expense_reduction`;
- non-zero adjustment не поддерживается в v1;
- canonical records проходят FIN-001/KPI Dictionary parity tests.

FX conversion не входит в DATA-010. Canonical record хранит исходную explicit currency; cross-currency analytics требует отдельного versioned FX layer.

## Provenance и source identity

`provenance` содержит:

- `source_system`;
- `source_container`;
- `source_record_id`;
- `source_fingerprint`;
- `identity_strategy`;
- `transform_version`;
- `source_position`.

Ключевой инвариант: **source position не является logical identity**.

Например, Google source row может переместиться с `row:10` на `row:44`; это меняет только `source_position`. Immutable identity/fingerprint canonical import остаётся прежней, если source core content не изменился.

Для источников со stable external ID используется `EXTERNAL_ID`. Для DATA-001 legacy migration shape, где stable external ID может отсутствовать, используется `CONTENT_FINGERPRINT_V1`: logical record identity строится из DATA-001 content fingerprint, который не зависит от row position.

Изменение `source_system`, `source_record_id`, `source_fingerprint`, `identity_strategy` или `transform_version` после canonical import считается source identity mutation и fail-closed.

## Collection invariants

Canonical collection validation блокирует:

- duplicate `transaction_id`;
- duplicate logical source identity;
- invalid schema/version;
- invalid IDs/timestamp/status/type;
- invalid exact money/currency;
- invalid dimensions/tags;
- invalid transfer/refund/adjustment semantics;
- unknown fields.

Shared errors используют bounded `CANONICAL_*` reason codes и не должны содержать real financial payload.

## DATA-001 migration compatibility

`fromMigrationCanonicalRecord()` переводит существующий DATA-001 canonical migration shape в v1:

- `source_sheet` → `source_container`;
- `source_row` → mutable `source_position`;
- DATA-001 `canonicalFingerprint()` → `source_record_id` + `source_fingerprint` для `CONTENT_FINGERPRINT_V1`;
- legacy `name` → canonical `description`;
- отсутствующий legacy status трактуется adapter'ом как explicit `posted` для historical migration compatibility.

`toMigrationCompatibilityRecord()` и `assertMigrationFingerprintParity()` доказывают round-trip fingerprint parity. Это **compatibility contract**, а не разрешение full-history migration.

## Privacy boundary

Public schema/tests используют только independently generated synthetic records. Реальные transaction rows, descriptions, categories, amounts, source locators и real-derived aggregates не входят в GitHub evidence.

## Scope boundary

DATA-010 не выполняет migration/cutover и не меняет private workbook. Full-history migration остаётся `MIG-010` и требует backup, idempotency, resume и private reconciliation gates.
