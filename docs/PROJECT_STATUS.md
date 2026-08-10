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

## R2 / Family Finance Center — P1 baseline завершён

- `DESIGN-020` — **DONE**, Issue #118 Main Verification PASS.
- `VIZ-020` — **DONE**, Issue #120 Main Verification PASS.
- `HOME-020` — **DONE**, Issue #122 Main Verification PASS.
- `TX-020` — **DONE**, Issue #124 Main Verification PASS.
- `EXP-020` — **DONE**, Issue #126 Main Verification PASS.
- `INC-020` — **DONE**, Issue #128 Main Verification PASS.
- `CF-020` — **DONE**, Issue #130 Main Verification PASS.
- `BUD-020` — **DONE**, Issue #132 Main Verification PASS.
- `OBL-020` — **DONE**, Issue #134 Main Verification PASS.
- `DQ-020` — **DONE**, Issue #136 Main Verification PASS.
- `PWA-020` — **DONE**, Issue #137 Main Verification PASS, PR #140 merge `c6910df6679fdc894635092c27cd3c463a69a364`.
- `PROF-020` — P2, не является текущим writer.

PWA boundary сохраняется: current Apps Script HtmlService service-worker activation = `NOT_PROVEN_CURRENT_HOST`; private financial/authenticated responses не кэшируются; private Web App остаётся `MYSELF`.

## R4 / Yandex Cloud shadow platform — текущий P1 writer

AIENG-002 resolver сначала выбрал `YC-040`, затем после его Main Verification выбрал следующий dependency-ready P1 item `AUTH-040`.

- `YC-040` YDB Serverless PoC + cost envelope — **DONE**, Issue #141 Main Verification PASS, PR #143 merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` Family authentication/authorization — **IN_PROGRESS**, Issue #142; current writer, branch `agent/AUTH-040-family-auth`.

### YC-040 verified boundary

`PRH_YDB_SERVERLESS_POC_V1@1.0.0` остаётся offline schema/adapter/cost-guard PoC, а не cloud cutover. Google остаётся authoritative runtime/store; YDB canonical write owner = false; real replication = false; production `PR_CONFIG.FINOPS.PROVIDERS` не получает YDB runtime authority. `FREE_ONLY` mandatory.

### AUTH-040 current boundary

`PRH_FAMILY_AUTH_V1@1.0.0` задаёт provider-neutral reference policy для будущего семейного auth boundary:

- raw identity assertion не доверяется; требуется injected verified-identity adapter;
- signed session использует runtime-injected HMAC-SHA256 key, version binding, idle/absolute lifetime и constant-time signature compare;
- roles/capabilities работают по explicit least-privilege allowlist;
- cross-household access всегда DENY;
- mutating application capabilities требуют single-use session/version/capability-bound nonce;
- authorization `ALLOW` не открывает backend financial write: `backend_financial_write_granted=false`;
- generic Google canonical write по-прежнему требует `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`;
- public telemetry запрещает financial payload, raw identity/session/token/key material и private runtime locators;
- current Apps Script Web App остаётся `MYSELF`; `public_exposure_change=false`;
- live IdP/Yandex IAM provisioning в AUTH-040 отсутствует;
- required CI использует independently generated synthetic identities only; `FREE_ONLY` mandatory.

Normative doc: `docs/security/FAMILY_AUTHORIZATION.md`. Contract/core: `lib/auth/family_auth.v1.json`, `lib/auth/family_auth.js`. Test: `tests/family_auth_contract_test.js`.

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

Private primary store/runtime: Google Sheets + Apps Script; family UI: private `MYSELF` Apps Script Web Dashboard. Public GitHub evidence is independently generated synthetic only. Google remains current canonical runtime authority. AUTH-040 не меняет current runtime exposure и не выполняет real-data mutation. `FREE_ONLY` mandatory.

## Что намеренно не утверждается

AUTH-040 не считается DONE до autonomous merge + Main Verification/Issue close. Reference auth policy не означает live identity-provider integration или публичный семейный endpoint. YC-040 не означает YDB production readiness/cutover. AUTH-040 не разрешает Google/YDB financial write. Historical MIG-010 authorization не переносится на future mutation/cutover.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.

Stale lower-priority document никогда не разрешает bypass current machine gate.
