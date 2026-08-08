# Financial Truth v1

Roadmap item: `FIN-001`  
Policy version: `FIN-TRUTH-v1`

## Golden truth

Financial KPI truth is produced from canonical transaction records through a versioned deterministic domain policy. Spreadsheet total cells, dashboard cells, chart values, and other presentation/read-model formulas are **not** golden truth and may only be compared as secondary diagnostics.

Public tests and CI use independently generated synthetic finance data only. Private reconciliation may read real source/runtime data, but only a technical `PASS/FAIL` result may cross into the public repository.

## Money boundary

`amount_minor` is a non-negative integer in minor currency units. Floating-point money is rejected at the domain boundary. Rounding or currency conversion must occur before a transaction enters this policy and must be governed by a later explicit definition where applicable.

## Included transaction semantics

`FIN-TRUTH-v1` includes `status=posted` records and defines:

- `income`: external inflow; contributes to Income and Cash Flow;
- `expense`: external outflow; contributes to gross Expense and reduces Cash Flow;
- `refund`: reduces external Expense and increases Cash Flow; it must contain either `reverses_transaction_id` or explicit `expense_reduction` adjustment semantics;
- `transfer`: movement between owned accounts; measured separately but neutral to family Income, Expense, and Cash Flow;
- `adjustment`: only zero-value neutral adjustment is accepted in v1. Non-zero adjustment requires a later versioned semantic definition.

Rows with other statuses are explicitly excluded and counted as exclusions; they are never silently included.

## Required invariants

For one policy version and the same transaction set:

1. Income equals the sum of included income transactions.
2. Net external Expense equals gross expense minus refunds.
3. Income category buckets sum exactly to Income.
4. Expense category buckets, with refunds represented as reductions, sum exactly to net external Expense.
5. Internal transfers do not change Income, net external Expense, or Cash Flow.
6. `Cash Flow = Income - net external Expense`.
7. Refund semantics are explicit rather than inferred from amount sign or UI labels.
8. Monetary values are integer minor units.
9. Canonical transaction IDs are unique inside a reconciliation set.
10. Period grouping is derived deterministically from `occurred_at`, including month/year boundaries.

## Public synthetic gate

`Financial reconcile synthetic` runs `tests/financial_reconciliation_contract_test.js` in PR CI. It verifies the deterministic golden fixture plus a larger generated fixture and fails closed on ambiguous refunds, floating money, duplicate transaction identity, invalid transfer semantics, or invariant mismatch.

## Private historical gate

Private reconciliation is read-only and applies the same financial semantics to source transaction rows with valid transaction type/date/amount/category core fields. A second independent category-partition aggregation must match row-wise totals for every available period. Legacy presentation totals are diagnostic inputs only and are never expected values.

Public evidence for this gate is limited to:

`private-reconciliation: PASS|FAIL`

No real amounts, categories, descriptions, row payloads, month totals, or mismatch deltas may be written to GitHub, CI logs, or public artifacts.

Source-to-canonical row identity/provenance completeness is a separate `DATA-001` gate; `FIN-001` does not silently redefine migration mismatches as financial truth.
