# Migration Reconciliation v1

Roadmap item: `DATA-001`  
Transform version: `SOURCE-TRANSFORM-v1`

## Why `source_row` is not identity

Spreadsheet row numbers are mutable coordinates. Inserting, deleting, sorting, or otherwise changing source rows can make a previously correct `source_row` point at a different transaction. Therefore `source_row` remains useful provenance/location evidence, but it cannot be the only stable migration identity.

The reconciliation contract adds a deterministic **source fingerprint** over:

- source system + source sheet;
- transform version;
- normalized canonical core fields: occurrence timestamp, type, integer minor-unit amount, currency, accounts, category, and name.

The fingerprint intentionally excludes `source_row`, so an unchanged source record can be recognized after row movement. A core-field edit changes the fingerprint and therefore cannot silently pass as the same migrated transaction.

## Effective reconciliation status

Stored migration status is not authoritative by itself. Every reconciliation run computes an effective status from current source evidence:

- `CLEAN` — current source row matches the canonical core and source quality is valid;
- `SOURCE_ROW_MOVED` — stored row no longer matches, but the exact fingerprint exists uniquely elsewhere;
- `SOURCE_MISSING` — neither stored row nor stable fingerprint can locate the source;
- `SOURCE_DUPLICATE` — stable source identity is ambiguous;
- `SOURCE_INVALID` — source needs explicit review/inference and cannot be auto-clean;
- `CORE_MISMATCH` — stored row exists but canonical core differs and the original fingerprint cannot be found elsewhere;
- `PROVENANCE_MISSING`, `SOURCE_REF_DUPLICATE`, `CANONICAL_ID_DUPLICATE` — structural fail-closed states.

Only `CLEAN` is a clean result. A previously stored clean label cannot override a current computed REVIEW reason.

## Idempotent import contract

A migration rerun plans one of three actions per normalized source record:

- `REUSE` when exactly one canonical fingerprint already exists;
- `INSERT` when no canonical fingerprint exists;
- `BLOCK` for ambiguous/invalid/duplicate identity.

The same source + canonical state must produce the same plan on every rerun. Re-importing an already migrated source record must never create a second canonical transaction.

## Private current-state verification

The current DEV/source pair is checked read-only with the same core-field and fingerprint semantics. Public evidence is limited to:

`private-migration-reconciliation: PASS|FAIL`

`PASS` means the reconciliation engine detects current false-clean/moved/mismatched source mappings as non-clean and does not allow them through the migration gate. It does **not** mean that stored legacy status cells were rewritten.

No source row numbers, transaction IDs, real values, categories, descriptions, mismatch fields, or moved-row locations may be published in GitHub/CI evidence.

## Mutation boundary

`DATA-001` does not rewrite current financial rows, provenance cells, or source data. Any later remediation that writes existing canonical rows must use the Roadmap backup/idempotency/readback/rollback contract. Full-history migration remains blocked until the later recoverability gate.
