# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Этот файл не может отменять красный gate.

## R0 — завершён

### MASTER-G0 / Truth — **complete**

`TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001 = DONE`.

### MASTER-G1 / Autonomous delivery + AI engineering — **complete**

`SEC-003 + CI-001 + CI-002 + CI-003 + AIENG-001 + AIENG-002 + AIENG-003 = DONE`.

AIENG chain: `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

### MASTER-G2 / Recoverability — **complete**

`DR-001 + OBS-001 + FINOPS-001 = DONE`.

## R1 / Canonical Financial Platform — текущая волна

- `FIN-010` Versioned KPI Dictionary — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` Canonical transaction schema v1 — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` Pure domain/application core — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` Repository interfaces + Google Sheets adapter — **DONE**, Issue #91 Main Verification PASS; previous lifecycle state was `IN_PROGRESS`.
- `MIG-010` Deterministic full-history migration — **IN_PROGRESS**, Issue #96, draft PR #97; current owner-private stage = **AUTHORIZATION_REQUIRED**.
- `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010` и другие items продолжаются только по declared dependencies/priority после текущего P0 writer.

FIN-010 contracts: `lib/finance/kpi_dictionary.v1.json`, `lib/finance/kpi_dictionary.js`, `docs/finance/KPI_DICTIONARY.md`.
DATA-010 contracts: `lib/domain/canonical_transaction.v1.schema.json`, `lib/domain/canonical_transaction.js`, `docs/data/CANONICAL_TRANSACTION_SCHEMA.md`.
ARCH-010: `PRH_APPLICATION_CORE_V1`, pure use-cases без I/O/network/financial-write authority.
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`, deterministic fake + Google adapter; generic Google canonical write остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## MIG-010 current truth

MIG-010 implementation включает:

- `PRH_FULL_HISTORY_MIGRATION_V1` — deterministic dry-run, bounded batches, HMAC resume, backup/authorization gate, reconciliation;
- `MIG010_REPAIR_POLICY_V1@1.1.0` + `REBUILD_LEGACY_SLICE_V1`;
- additive Canonical v1 identity `CONTENT_FINGERPRINT_OCCURRENCE_V1` для owner-confirmed identical real operations;
- owner-local encrypted-backup snapshot/dry-run/private diagnostics;
- offline duplicate owner review + exact-bound resolution;
- independent resolved rebuild dry-run;
- `MIG010_EXECUTION_POLICY_V1@1.0.0` + `STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`;
- owner-private execution-package builder;
- separate authorization-gated `Mig010ExecutionGateway.js` с staging/readback/rollback;
- owner-local authorized executor, который без private `IRREVERSIBLE_ACTION_AUTHORIZED` fail-closed;
- fresh-backup post-write reconciliation verifier.

Owner-private checkpoint достигнут без публикации financial payload:

- encrypted-backup snapshot — PASS;
- initial full-history dry-run — корректно `BLOCKED`, что выявило legacy anomalies;
- private diagnostics — PASS;
- duplicate semantics — решены владельцем private review;
- repair resolve — `READY_FOR_REBUILD_DRY_RUN`, blockers cleared;
- independent resolved rebuild dry-run — **PASS**, `reconciliationReady=true`;
- current real write authorization — **false**;
- ни один real migration batch ещё не выполнялся.

`SOURCE_INVALID` остаётся explained private quarantine. Owner-confirmed identical operations используют `CONTENT_FINGERPRINT_OCCURRENCE_V1`: content fingerprint не искажается, а отдельные реальные occurrences получают deterministic distinct identities.

### Current irreversible boundary

```text
RESOLVED_REBUILD_DRY_RUN = PASS
-> EXECUTION_PACKAGE
-> AUTHORIZATION_REQUEST
-> AUTHORIZATION_REQUIRED
-> (только после owner IRREVERSIBLE_ACTION_AUTHORIZED)
   STAGING -> READBACK -> FINALIZED_PENDING_RECONCILIATION
-> FRESH ENCRYPTED BACKUP
-> POST-WRITE RECONCILIATION, unexplainedMismatch=0
-> OWNER_VERIFIED
```

Execution package/authorization request не являются разрешением. GitHub Actions, merge PR и AI-agent не могут создать `IRREVERSIBLE_ACTION_AUTHORIZED`.

`Mig010ExecutionGateway.js` не ослабляет ARCH-011: generic Google repository mutation остаётся запрещённой. MIG gateway — отдельный narrowly scoped owner-authorized path, связанный exact hashes, fresh backup и private session.

Finalize выполняется только после полного staging hash verification. При finalize failure live target восстанавливается из hidden rollback copy. После успешного finalize rollback сохраняется до fresh-backup reconciliation PASS.

**Private full-history migration пока не выполнена и не разрешена.**

### MASTER-G3 / Canonical platform — **open**

Exit требует `FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE`, а также private full-history reconciliation и synthetic performance PASS.

## Pure core + repository boundary

`lib/domain/**`, `lib/finance/**`, `lib/migration/**`, `lib/application/**` — pure boundary. Application core не имеет I/O/network/financial-write authority.

ARCH-011 добавил storage-neutral repository port и Google Sheets adapter снаружи pure core. Наличие `writeBatch()` interface не создаёт permission: current generic Google adapter возвращает `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

MIG-010 execution gateway является отдельной policy boundary и не меняет generic repository authority.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract.

- `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` задают continuation, one-writer ownership и lifecycle.
- `tools/multi-ai-review-protocol.js` + `PRH_MULTI_AI_REVIEW_PACKET_V1` / `PRH_MULTI_AI_REVIEW_REPORT_V1` задают supplementary exact-candidate review.
- reviewers всегда `READ_ONLY`, `writer_authority=false`; unresolved P0/P1 blocks review evidence, P2/P3 advisory.
- required AI checks deterministic/local и не требуют paid AI/API provider.

## Current runtime truth

- private primary store/runtime: Google Sheets + Apps Script;
- family UI: private `MYSELF` Apps Script Web Dashboard;
- Dashboard render path после INC-001 использует raw `HtmlOutput` placeholder injection; trusted runtime health включает Web App render smoke v2;
- public GitHub finance content: independently generated synthetic only;
- DEV delivery: exact-SHA autonomous pipeline;
- PROD/cutover/destructive data actions: separate policy gates;
- `FREE_ONLY` обязателен; paid-by-usage provider activation не разрешён автоматически.

## Что намеренно не утверждается

- full-history migration **не** завершена;
- owner-private repair/rebuild verification **не** является authorization на real financial writes;
- execution package/request **не** является authorization;
- authorized migration **не** выполнялась;
- `unexplainedMismatch=0` на post-write real workbook **ещё не доказан**;
- Google -> Yandex cutover **не** выполнен;
- private Dashboard **не** сделан публичным;
- public Git history rewrite **не authorized/executed**;
- paid cloud/AI/OCR provider **не** включён;
- последующие R1 items не считаются DONE до собственных machine gates/Main Verification.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. repository `docs/ROADMAP.md` v2.3;
3. external Master Audit / AI Development Playbook, когда явно предоставлены;
4. active Roadmap Issue/task packet;
5. executable exact-SHA code/tests/workflows;
6. architecture/ADR/operations docs;
7. README/user docs;
8. historical changelog/release notes.

Stale lower-priority документ никогда не разрешает bypass current machine gate.
