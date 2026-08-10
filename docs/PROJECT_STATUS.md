# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

## R0 — завершён

### MASTER-G0 / Truth — **complete**
`TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001 = DONE`.

### MASTER-G1 / Autonomous delivery + AI engineering — **complete**
`SEC-003 + CI-001 + CI-002 + CI-003 + AIENG-001 + AIENG-002 + AIENG-003 = DONE`.

### MASTER-G2 / Recoverability — **complete**
`DR-001 + OBS-001 + FINOPS-001 = DONE`.

`AIENG-001 = DONE`; `AIENG-002 = DONE`; `AIENG-003 = DONE`.

## R1 / Canonical Financial Platform — завершённая волна

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS.
- `TEST-010` — **DONE**, Issue #100 Main Verification PASS.
- `OBS-010` — **DONE**, Issue #103 Main Verification PASS.
- `PERF-010` — **DONE**; `PERF-011` — **DONE**; `PERF-012` — **DONE**; `PERF-013` — **DONE**; `PERF-014` — **DONE**.
- `DOC-010` — **DONE**, Issue #116 Main Verification PASS.

FIN-010 authority: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA-010 authority: `PRH_CANONICAL_TRANSACTION_V1`. ARCH-010: `PRH_APPLICATION_CORE_V1`, `io_authority: false`. ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`. ANL-010: `PRH_ANALYTICS_CONTRACT_V1@1.0.0`; `financial_write=false`.

### MASTER-G3 / Canonical platform — **complete**; historical pre-close state: open

`FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE`; private full-history reconciliation = PASS; independently generated synthetic 20k/50k performance = PASS.

## R2 / Family Finance Center — текущая волна

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS.
- `HOME-020` — **DONE**, Issue #122 Main Verification PASS.
- `TX-020` — **DONE**, Issue #124 Main Verification PASS.
- `EXP-020` — **DONE**, Issue #126 Main Verification PASS.
- `INC-020` — **DONE**, Issue #128 Main Verification PASS.
- `CF-020` — **DONE**, Issue #130 Main Verification PASS.
- `BUD-020` — **DONE**, Issue #132 Main Verification PASS, merge `6ab8db5b07c31cebc0d942be576a7b2a712dded1`.
- `OBL-020` Obligations & recurring dashboard — **IN_PROGRESS**, Issue #134; current R2 writer, branch `agent/OBL-020-obligations-recurring`.

### OBL-020 current boundary

`PRH_OBLIGATIONS_V1@1.0.0` — read-only planning model обязательств и повторяющихся потоков поверх DATA-010/DESIGN-020.

- explicit bounded planning window `[window_start, window_end)`, максимум 366 дней;
- recurrence v1: `ONCE`, `WEEKLY`, `MONTHLY`; monthly policy `CLAMP_TO_LAST_DAY`;
- stable occurrence identity = `SHA256(PRH_OBLIGATION_OCCURRENCE_V1|PLAN_ID|DUE_DATE)`;
- completion задаётся только explicit `completed_due_dates`; fuzzy transaction matching отсутствует;
- states: `OVERDUE`, `DUE`, `UPCOMING`, `FORECAST` относительно explicit `as_of`;
- planning amount/direction и forecast **не являются FIN-TRUTH**;
- mixed-currency view fail-closed;
- OBL не создаёт canonical transactions автоматически и не получает storage/network/financial-write authority;
- public telemetry не содержит amount/label/private plan IDs;
- public evidence — independently generated synthetic only; `FREE_ONLY` mandatory.

Normative doc: `docs/analytics/OBLIGATIONS_RECURRING.md`. Core: `lib/obligations/obligations.js`. Tests: `tests/obligations_contract_test.js`, `tests/obligations_visual_test.js`.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract. `AIENG-001`, `AIENG-002`, `AIENG-003` are DONE. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation. Read-only multi-AI reviewers have `writer_authority=false`; machine gates and Main Verification remain authoritative.

## Current delivery chain

```text
active Roadmap Issue
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health + Web App render smoke
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE
```

## Current runtime truth

Private primary store/runtime: Google Sheets + Apps Script; family UI: private `MYSELF` Apps Script Web Dashboard. Public GitHub finance/render evidence is independently generated synthetic only. DEV delivery is exact-SHA autonomous. PROD/cutover/destructive data actions remain separate policy gates. `FREE_ONLY` mandatory.

## Что намеренно не утверждается

OBL-020 не считается DONE до autonomous merge + Main Verification/Issue close. Obligation forecast не является financial fact. OBL-020 не разрешает Google write и не создаёт операции автоматически. Historical MIG-010 authorization не переносится на future mutation. Private Dashboard не сделан публичным.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.

Stale lower-priority document никогда не разрешает bypass current machine gate.
