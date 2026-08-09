# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, owner-private mapper/snapshot/state/diagnostic/repair/execution payload здесь запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **каноническая Executable GitHub Roadmap v2.3**.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Architecture/ADR/operations docs.

Chat history/memory и stale Roadmap copies not authority. При явном предоставлении `Master Audit v2.1` и `AI Development Playbook v1.0` действует precedence из `AGENTS.md`.

## Current R0 truth

R0 machine-proven complete. `MASTER-G0`, `MASTER-G1`, `MASTER-G2` закрыты. AIENG chain: `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

## Current R1 truth

- `FIN-010` — DONE.
- `DATA-010` — DONE.
- `ARCH-010` — DONE, Issue #89 Main Verification PASS.
- `ARCH-011` — DONE; historical lifecycle: `ARCH-011` was the current writer before MIG-010, Issue #91 Main Verification PASS.
- `MIG-010` — DONE, Issue #96 Main Verification PASS; private stage `OWNER_VERIFIED` retained as historical evidence.
- `ANL-010` — **current P1 writer**, Issue #98, draft PR #99.

`PRH_TRANSACTION_REPOSITORY_V1` remains storage-neutral repository port. Generic Google canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## ANL-010 analytics boundary

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` defines:

- `PRH_ANALYTICS_QUERY_V1` — strict measures/dimensions/filters/time/grain/comparison/sort/parameters/limit;
- `PRH_ANALYTICS_RESULT_V1` — deterministic rows + query hash + upstream provenance.

Supported measures are FIN-010 KPI IDs and are evaluated through `evaluateKpis()` rather than duplicated financial formulas. Therefore `FIN-TRUTH-v1`, integer minor units, posted-only behavior, transfer neutrality, refund semantics, single-currency policy and explicit partial periods remain upstream authority.

Supported v1 dimensions: `account_id`, `category_id`, `member_id`, `project_id`, `type`. Empty dimensions means one ungrouped aggregate. Filters are bounded `EQ`/`IN`; canonical normalization sorts filter/value order for deterministic query identity.

Time range uses explicit half-open `[start,end)` days. Grains: `NONE`, `DAY`, `MONTH`, `YEAR`. `PREVIOUS_PERIOD` comparison is the immediately preceding interval with equal day count. No implicit month normalization/proration.

`BUDGET_VARIANCE` requires explicit integer `budget_minor`; v1 intentionally rejects grouped/grained budget variance because no allocation policy exists. Empty scoped periods still delegate to FIN-010, so variance remains `budget - zero expense`.

Analytics authority contract: `io=false`, `network=false`, `financial_write=false`, `ui=false`; renderer/storage-neutral. Chart/Widget specs are not ANL-010 scope.

Normative doc: `docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md`.

## MIG-010 historical verified boundary

`PRH_FULL_HISTORY_MIGRATION_V1`, `MIG010_REPAIR_POLICY_V1@1.1.0`, `CONTENT_FINGERPRINT_OCCURRENCE_V1`, `MIG010_EXECUTION_POLICY_V1@1.0.0` and adaptive typed staging remain active historical contracts.

Owner-private execution was exact-authorized and verified by fresh encrypted post-write reconciliation:

- `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`;
- `unexplainedMismatch=0`;
- `provenanceComplete=true`;
- `idempotentRerunNoop=true`;
- `rollbackCanBeReleased=true`.

This one-time evidence does not grant continuing generic write authority. Hidden staging/rollback cleanup was not automatic.

GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; merge/AI cannot transfer owner authorization to later mutations.

## Current delivery

```text
Roadmap Issue IN_PROGRESS
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health + Web App render smoke v2
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE/closed
```

ANL-010 remains draft until behavioral/docs/machine evidence is complete. After a final exact candidate is green, PR is marked ready and the normal CI-003/Main Verification chain must close Issue #98 before ANL-010 can be called DONE.

## Executable continuation protocol

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` select/continue exactly one dependency-ready writer. Multiple writers, missing dependencies or private context fail closed.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers always `READ_ONLY`, `writer_authority: false`; P0/P1 block review evidence, P2/P3 advisory. Review does not override machine gates/Main Verification.

## Privacy / financial / cost boundaries

Real or real-derived household finance data stays private. Public finance fixtures are independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys and migration owner-private artifacts stay private.

ANL-010 public tests contain synthetic transactions only. Real analytics queries/results are private runtime data and must not become GitHub fixtures, logs or issue evidence.

`FREE_ONLY` remains mandatory.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`, integer minor units, posted-only, transfer-neutral, refund as expense reduction, mixed-currency fail-closed.

DATA-010: `PRH_CANONICAL_TRANSACTION_V1`; `source_position` mutable locator, not identity. Owner-confirmed identical operations may use `CONTENT_FINGERPRINT_OCCURRENCE_V1` without modifying financial fields for uniqueness.

ARCH-010: `PRH_APPLICATION_CORE_V1`; `io_authority=false`, `financial_write_authority=false`, `network_authority=false`.

ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation remains blocked.

ANL-010: `PRH_ANALYTICS_CONTRACT_V1`; pure query/evaluation boundary, renderer/storage-neutral, `financial_write=false`.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Issue #98
4. `/docs/PROJECT_STATUS.md`
5. `/docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md`
6. `/lib/analytics/analytics_contract.v1.json`
7. `/lib/analytics/analytics_engine.js`
8. `/tests/analytics_extension_contract_test.js`
9. `/docs/finance/KPI_DICTIONARY.md`
10. `/docs/data/CANONICAL_TRANSACTION_SCHEMA.md`
11. `/docs/architecture/PURE_DOMAIN_APPLICATION_CORE.md`
12. exact candidate code/tests/workflows

## Scope handoff

`AIENG-001/002/003`, `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010` = DONE. `ANL-010` = current R1 writer. Other R1 items remain dependency/priority-gated until its Main Verification.
