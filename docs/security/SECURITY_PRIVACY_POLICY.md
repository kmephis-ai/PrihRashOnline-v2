# Security & privacy policy-as-code

Roadmap item: `SEC-002`  
Cost class: `FREE_ONLY`

## Trust boundary

Public GitHub and PR CI may contain source code, documentation, independently generated synthetic fixtures, and technical PASS/FAIL evidence. Real household financial rows, values, aggregates, descriptions, categories, authenticated runtime HTML, and raw financial payloads remain private.

## Audit / telemetry contract

`SecurityPrivacyPolicy.js` is the runtime allowlist for structured audit metadata. `before`, `after`, and `details` are reduced to explicitly approved technical scalar fields such as build/schema/revision, action/error class, latency, cache state, row counters, quota class, reconciliation/runtime-health status, idempotency/revision metadata, and technical status/reason codes.

Financial/business fields are not telemetry. Amounts, income/expense/balance data, descriptions, merchants/counterparties, categories, transactions, accounts, comments/notes, and raw payload fields are not persisted by the audit serializer.

Free-form `event.message` and `event.target` are intentionally not persisted. Callers that need searchable audit context use bounded technical `messageCode` and `targetType` values.

## Repository gates

PR Validation runs the following security gates before build/test evidence:

1. `node tools/secret-scan.js` — high-confidence current-tree credential scan and blocked credential/config paths;
2. `node tools/privacy-public-data-scan.js` — synthetic-only public-data boundary;
3. deterministic build validation and contract/UI tests.

The repository-level secret scanner is a preventive PR gate. Historical exposure is handled separately by the non-destructive history inventory/remediation plan; rewriting public Git history remains an explicit owner-policy gate.

## Local Apps Script configuration

Deployment-specific `.clasp.json`, `.clasprc.json`, `.env*`, credential directories, and service-account files are not tracked. `.clasp.json.example` contains only a placeholder contract. Trusted deployment automation must construct required local configuration from its trusted environment rather than commit it to Git.

## Scope boundaries

This item does not pin third-party Actions, upgrade Node, create the lockfile, or redesign trusted deployment. Those belong to the supply-chain and CI Roadmap items. It also does not change financial data or financial business semantics.
