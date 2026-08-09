# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Этот файл не может отменять красный gate.

## R0 — завершён

### MASTER-G0 / Truth — **complete**

`TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001 = DONE`.

### MASTER-G1 / Autonomous delivery + AI engineering — **complete**

`SEC-003 + CI-001 + CI-002 + CI-003 + AIENG-001 + AIENG-002 + AIENG-003 = DONE`.

### MASTER-G2 / Recoverability — **complete**

`DR-001 + OBS-001 + FINOPS-001 = DONE`.

## R1 / Canonical Financial Platform — текущая волна

- `FIN-010` Versioned KPI Dictionary — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` Canonical transaction schema v1 — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` Pure domain/application core — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` Repository interfaces + Google Sheets adapter — **DONE**, Issue #91 Main Verification PASS; previous lifecycle state was `IN_PROGRESS`.
- `MIG-010` Deterministic full-history migration — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED`, fresh encrypted post-write reconciliation PASS.
- `ANL-010` Analytics extension contract v1 — **IN_PROGRESS**, Issue #98, draft PR #99; current R1 writer.
- `TEST-010`, `OBS-010`, `PERF-010` и другие items остаются dependency/priority-gated до завершения current writer.

FIN-010 contracts: `lib/finance/kpi_dictionary.v1.json`, `lib/finance/kpi_dictionary.js`, `docs/finance/KPI_DICTIONARY.md`.
DATA-010 contracts: `lib/domain/canonical_transaction.v1.schema.json`, `lib/domain/canonical_transaction.js`, `docs/data/CANONICAL_TRANSACTION_SCHEMA.md`.
ARCH-010: `PRH_APPLICATION_CORE_V1`, pure use-cases без I/O/network/financial-write authority.
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`, deterministic fake + Google adapter; generic Google canonical write остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## ANL-010 current truth

ANL-010 вводит `PRH_ANALYTICS_CONTRACT_V1@1.0.0` с двумя versioned surfaces:

- `PRH_ANALYTICS_QUERY_V1` — measures, dimensions, filters, explicit `[start,end)` time range, grain, comparison, sort и bounded parameters/limits;
- `PRH_ANALYTICS_RESULT_V1` — deterministic rows/series shape, query identity и canonical/KPI/FIN provenance.

Financial semantics не дублируются: supported measures делегируются FIN-010 `evaluateKpis()` и сохраняют `FIN-TRUTH-v1`, integer minor units, single-currency fail-closed, posted-only accounting, transfer neutrality и refund-as-expense-reduction.

Analytics contract renderer/storage-neutral и не имеет I/O/network/UI/financial-write authority. Public tests используют только independently generated synthetic transactions. ChartSpec/WidgetSpec, renderer selection и advanced OLAP остаются отдельными Roadmap scopes.

Current behavioral evidence:

- strict query validation + deterministic canonical query hash;
- ungrouped `dimensions: []` supported;
- dimensions/filter/time grain grouping;
- `PREVIOUS_PERIOD` comparison with explicit same-length preceding interval;
- budget variance requires explicit integer `budget_minor` and v1 forbids implicit grouped allocation semantics;
- empty-period budget variance preserves FIN-010 `budget - zero expense` semantics;
- randomized synthetic KPI parity/property checks;
- pure boundary scan rejects Apps Script/DOM/network/write dependencies.

Normative contract: `docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md`.

## MIG-010 verified historical boundary

MIG-010 owner-private flow completed:

```text
RESOLVED_REBUILD_DRY_RUN = PASS
-> exact execution package/request
-> owner IRREVERSIBLE_ACTION_AUTHORIZED
-> STAGING + READBACK
-> FINALIZED_PENDING_RECONCILIATION
-> FRESH ENCRYPTED BACKUP
-> POST-WRITE RECONCILIATION
-> OWNER_VERIFIED
-> PR/Main Verification
-> DONE
```

Private evidence established `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Generic repository write authority did not change. Hidden staging/rollback cleanup was not performed automatically and is not implied by DONE.

### MASTER-G3 / Canonical platform — **open**

Private full-history reconciliation gate is PASS. MASTER-G3 still requires `FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE` and synthetic performance PASS.

## Pure core + repository boundary

`lib/domain/**`, `lib/finance/**`, `lib/migration/**`, `lib/application/**`, `lib/analytics/**` are pure boundaries. They do not own platform I/O/network/financial-write authority.

ARCH-011 exposes the storage-neutral repository port outside the pure domain. Presence of `writeBatch()` interface does not grant Google mutation permission; current generic Google adapter returns `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

ANL-010 consumes canonical transactions as plain data and returns plain analytics result objects. It does not know whether source data came from Google Sheets, a synthetic fake or a future YDB adapter.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract.

- `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` define continuation, one-writer ownership and lifecycle.
- `tools/multi-ai-review-protocol.js` + `PRH_MULTI_AI_REVIEW_PACKET_V1` / `PRH_MULTI_AI_REVIEW_REPORT_V1` define supplementary exact-candidate review.
- reviewers always `READ_ONLY`, `writer_authority=false`; unresolved P0/P1 blocks review evidence, P2/P3 advisory.
- required AI checks deterministic/local and require no paid AI/API provider.

## Current runtime truth

- private primary store/runtime: Google Sheets + Apps Script;
- family UI: private `MYSELF` Apps Script Web Dashboard;
- Dashboard render path after INC-001 uses raw `HtmlOutput` placeholder injection; trusted runtime health includes Web App render smoke v2;
- public GitHub finance content: independently generated synthetic only;
- DEV delivery: exact-SHA autonomous pipeline;
- PROD/cutover/destructive data actions: separate policy gates;
- `FREE_ONLY` mandatory; paid-by-usage provider activation is not automatic.

## Что намеренно не утверждается

- ANL-010 не считается DONE до CI-003 merge + Main Verification/Issue close;
- analytics contract не создаёт chart/UI implementation и не даёт financial-write authority;
- owner authorization MIG-010 не переносится на future mutations;
- hidden MIG staging/rollback cleanup не выполнен автоматически;
- Google -> Yandex cutover не выполнен;
- private Dashboard не сделан публичным;
- public Git history rewrite не authorized/executed;
- paid cloud/AI/OCR provider не включён.

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
