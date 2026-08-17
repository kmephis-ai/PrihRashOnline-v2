# TX-020 — Transaction Explorer

## Status

`TX-020` is the current R2 writer. Machine contract: `PRH_TRANSACTION_EXPLORER_V1@1.0.0` in `lib/explorer/transaction_explorer.v1.json`.

## Purpose

Transaction Explorer provides a fast family-facing read/explore surface over `PRH_CANONICAL_TRANSACTION_V1` without creating a second financial truth or silently enabling financial writes.

## Query contract

`PRH_TRANSACTION_EXPLORER_QUERY_V1` supports:

- explicit start-inclusive/end-exclusive date window;
- account/category/member/type/status multi-select filters;
- bounded case-normalized text search over `counterparty`, `description`, `tags` only;
- allowlisted sort fields;
- stable `transaction_id` tie-breaker;
- bounded `OFFSET_LIMIT_V1` pagination, default 50, maximum 200;
- SHA-256 normalized query identity.

Unknown fields, duplicate filter values, invalid date ranges, unsupported sort fields/directions and oversized page/search requests fail closed.

## Canonical projection

Explorer validates the input collection through DATA-010 and returns `PRH_TRANSACTION_EXPLORER_ROW_V1` projections. Row values are canonical values. Explorer does not aggregate them and does not evaluate Income/Expense/Cash Flow/KPI formulas.

## Edit draft boundary

`PRH_TRANSACTION_EDIT_DRAFT_V1` separates validation from mutation.

Editable fields are explicit. `schema`, `schema_version`, `transaction_id` and `provenance` are immutable. A candidate reaches `VALID` only after `normalizeCanonicalTransaction()` and source-identity immutability validation.

Invalid candidates return a bounded reason code such as `CANONICAL_AMOUNT_MINOR_INVALID`; they do not become save requests.

## Financial write boundary

A valid draft **does not authorize a write**. Current runtime save result is:

```text
state = WRITE_BLOCKED
reason_code = GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED
financial_write_authorized = false
```

A future write-enabled transaction editor requires a separate versioned policy proving at minimum idempotency, preconditions, backup, readback, reconciliation and rollback. Any irreversible action remains subject to fresh exact-bound owner authorization rules. TX-020 does not reuse historical MIG-010 authorization.

## Performance

The contract test exercises independently generated synthetic canonical datasets at 20k and 50k records. Search/filter/sort runs against the bounded query model and returns at most 200 rows per page. CI wall-clock ceilings are regression guardrails, not production SLA.

## Browser surface

`TransactionExplorerWebApp.html` is a responsive synthetic browser surface for desktop/laptop/mobile interaction evidence. It demonstrates search, filters, sorting, pagination, edit drawer, dark/light theme and explicit blocked-save UX. It does not silently replace the existing private Apps Script route.

## Privacy

Public code/tests/screenshots may contain independently generated synthetic transactions only. Real or real-derived transaction rows, IDs, amounts, descriptions, counterparties, distributions, screenshots and runtime locators remain private.

Public telemetry is allowlisted to technical metadata: schema/version/query hash, counts, offset/limit, elapsed time, edit state and reason code. Private transaction values/IDs are not telemetry.

## Cost

`FREE_ONLY` is mandatory. No external search service, table provider, CDN or paid API is required.

## Machine evidence

- `tests/transaction_explorer_contract_test.js` → named gate `Transaction Explorer`;
- `tests/transaction_explorer_visual_test.js` → named gate `Transaction Explorer visual gate`;
- TEST-010 full layered suite includes both tests;
- existing DATA/FIN/ANL/PERF/DESIGN/VIZ/HOME/privacy/FREE_ONLY gates remain blocking.

## Rollback

Revert `lib/explorer/**`, `TransactionExplorerWebApp.html`, TX tests/docs/gates. Canonical data, Google repository/write boundary, existing Dashboard/Home and financial truth remain unchanged.
