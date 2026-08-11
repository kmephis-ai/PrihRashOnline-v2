# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

## R0 — critical path завершён

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — **complete**. `DOC-001`, `DOC-002`, `AIENG-001`, `AIENG-002`, `AIENG-003`, `AIENG-004`, `AIENG-006`, `DR-001`, `OBS-001`, `FINOPS-001` — DONE/Main Verification PASS.

`LANG-RU` обязателен. AI playbooks не создают authority; PR/Migration review остаются READ_ONLY.

## R1 / Canonical Financial Platform — завершена

- `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`, `AIENG-005` — **DONE/Main Verification PASS**.
- `MIG-010` owner-private `OWNER_VERIFIED` reconciliation = PASS.
- `ANL-010` authority = `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.

`MASTER-G3 / Canonical platform` — **complete**; historical pre-close state: open. FIN authority: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority: `PRH_CANONICAL_TRANSACTION_V1`. Repository authority: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## R2 / Family Finance Center — canonical UI cutover завершён

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — DONE/Main Verification PASS.

- `UI-MIG-020` — DONE, Issue #172, candidate `867fda74824f91bf3931aa3e6ea39d1c7d4dfc1e`, merge `0a87bab34f29897fa781a030797a9a040fb200a3`.

Canonical private Web App default = R2 Financial Home. Generated canonical-lib runtime успешно прошёл authenticated private Home smoke; `PRH_RUNTIME_DIMENSION_LABEL_HASH_V1` остаётся transient read-only adapter identity, `persistent_identity_authority=false`, `financial_formula_copy=false`. Private Web App остаётся `MYSELF`; `NOT_PROVEN_CURRENT_HOST` PWA boundary сохраняется; `FREE_ONLY` обязателен.

## R3 / Planning, Wealth, Decision Intelligence

- `TREND-030` — DONE/Main Verification PASS.
- `PROJ-030` — DONE/Main Verification PASS.
- `GOAL-030` — DONE/Main Verification PASS.
- `BAL-030` — DONE/Main Verification PASS.
- `NW-030` — DONE/Main Verification PASS.
- `SUB-030` — **DONE**, Issue #179 Main Verification PASS, candidate `2c3a0a39aa835cec2a5fa0a93d0a275b7bf008fd`, merge `2914f150a9b038af50f7ccbfd9ed3d4f684dad47`.

`SUB-030` authority = `PRH_SUBSCRIPTION_DETECTION_V1@1.0.0`: precision-first proposal-only detector, only canonical posted expenses; fuzzy/LLM matching, auto-confirm, obligation creation, canonical mutation и financial write запрещены. Explicit OBL link remains exact-only. Public evidence synthetic-only.

BAL authority remains `PRH_BALANCE_RECONCILIATION_V1@1.0.0`; no implicit zero balance. NW authority remains `PRH_NET_WORTH_V1@1.0.0`; no silent FX/market valuation and valuation layer `financial_truth=false`.

## R4 / Yandex Cloud shadow platform

- `YC-040` — DONE/Main Verification PASS.
- `AUTH-040` — DONE/Main Verification PASS.
- `YC-041` — BLOCKED, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`; writer authority отсутствует.
- `YC-042` — BLOCKED, Issue #149, `OWNER_YDB_TARGET_REQUIRED`; writer authority отсутствует.

Google остаётся authoritative; cloud blockers не создают billing-backed resources и не меняют canonical write ownership.

## R7 / Semantic Analytics — текущий writer

- `ANL-070` — DONE/Main Verification PASS.
- `SCOPE-070` — DONE/Main Verification PASS.
- `ANL-071` — DONE/Main Verification PASS.
- `ANL-074` — DONE/Main Verification PASS.
- `ANL-072` — **IN_PROGRESS**, Issue #178, branch `agent/ANL-072-safe-calculated-metrics`, PR #181.

ANL-072 authority = `PRH_ANALYTICS_CALCULATED_METRICS_V1@1.0.0`. Слой принимает только validated `ANL-071` `AnalyticsResult` и добавляет whitelist calculated/window metrics: `SHARE`, `DELTA_ABS`, `DELTA_PCT`, `CUMULATIVE`, `MOVING_AVERAGE`, `MOVING_MEDIAN`, `TOP_N_OTHER`, `RATIO_PPM`. Базовые значения не пересчитываются и не заменяются; `FIN-TRUTH-v1` и semantic registry остаются upstream authority.

Ключевые fail-closed правила: explicit measure/dimension scope; previous-period source обязателен для delta; division by zero не даёт `Infinity/NaN`, а возвращает typed undefined reason; moving window обязан иметь явную ширину; unsupported formula либо currency mismatch = FAIL; integer-safe accumulation обязателен. `TOP_N_OTHER` не теряет total; output содержит deterministic definition hash и provenance. Public telemetry не содержит financial values/private IDs. Storage/network/runtime/financial-write authority отсутствует; `FREE_ONLY` mandatory.

ANL-072 не изменяет private Web App и не является новым financial truth calculator. После завершения его result может использоваться future Analytics Studio поверх того же semantic/query contract.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is public-safe AI operating contract. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation. Read-only multi-AI reviewers have `writer_authority=false`; machine gates and Main Verification remain authoritative.

## Current delivery chain

```text
active Roadmap Issue
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE
```

ANL-072 остаётся открытым до `Calculated/window metrics` + semantic/period/SUB/DATA/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA PASS, immutable exact candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Current runtime truth

Private primary store/runtime: Google Sheets + Apps Script. ANL-072 — pure analytics post-processing layer и не подключает новый storage/runtime write path. Public GitHub evidence independently generated synthetic only. Private UI remains `MYSELF`; `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
