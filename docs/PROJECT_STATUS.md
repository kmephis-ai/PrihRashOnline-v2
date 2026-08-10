# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

## R0 — critical path завершён

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — **complete**. `DOC-001`, `DOC-002`, `AIENG-001`, `AIENG-002`, `AIENG-003`, `AIENG-004`, `AIENG-006`, `DR-001`, `OBS-001`, `FINOPS-001` — DONE/Main Verification PASS.

- `AIENG-004` — **DONE**, Issue #157 Main Verification PASS, merge `280dea294b086fae3cedf56df7899c9938b42b88`.
- `AIENG-006` — **DONE**, Issue #146 Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`.

`LANG-RU` обязателен. `PRH_AI_PLAYBOOK_CATALOG_V1@1.0.0` не создаёт authority; PR/Migration review остаются READ_ONLY.

## R1 / Canonical Financial Platform — завершена

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.
- `AIENG-005` — **DONE**, Issue #159 Main Verification PASS, merge `5fe90929f5f266fcd92bbc9745f78107083f6b5c`.

`MASTER-G3 / Canonical platform` — **complete**; historical pre-close state: open. FIN authority: `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority: `PRH_CANONICAL_TRANSACTION_V1`. Repository authority: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

`PRH_AI_EVAL_SUITE_V1@1.0.0` остаётся local deterministic regression gate: synthetic golden tasks, no required external model/network/paid API, `eval_grants_authority=false`, `FREE_ONLY`.

## R2 / Family Finance Center — P1/P2 baseline завершён

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020` — DONE/Main Verification PASS.

- `PROF-020` — **DONE**, Issue #162 Main Verification PASS, merge `c925deb4298c1046ec7ab06def3f559623d6b29f`.

`PRH_HOUSEHOLD_PREFERENCES_V1@1.0.0` остаётся configuration-domain authority; planner не выдаёт authorization и не выполняет financial write.

PWA boundary сохраняется: current Apps Script HtmlService service-worker activation = `NOT_PROVEN_CURRENT_HOST`; private financial/authenticated responses не кэшируются; private Web App остаётся `MYSELF`.

## R3 / Planning, Wealth, Decision Intelligence — текущий writer

- `TREND-030` — **DONE**, Issue #164 Main Verification PASS, candidate `676dddc9d6cfd23a9c57cca4b7a12a27fee31140`, merge `fe1660fa063fbc5e3344c9e570188fed9262b2ce`.
- `PROJ-030` — **DONE**, Issue #166 Main Verification PASS, candidate `f0fb557783960342db931488d2de97116c518b30`, merge `cb3bbc4d50c35e690fda76eda54b19d1b97fc0a9`.
- `GOAL-030` Goals & Wish-list — **IN_PROGRESS**, Issue #168, branch `agent/GOAL-030-goals-wishlist`.

TREND-030 authority `PRH_LONG_TERM_TRENDS_V1@1.0.0` остаётся observed long-term analytics boundary и не переопределяет FIN-TRUTH. PROJ-030 authority `PRH_CASH_FLOW_PROJECTION_V1@1.0.0` остаётся deterministic projection baseline с `financial_truth=false`, `projection_not_observation=true` и `future_fact_access=false`.

GOAL-030 authority = `PRH_GOAL_PLANNING_V1@1.0.0`. Goal target/currency/deadline/priority/status и funding events относятся к planning domain. Funding provenance строго `DECLARED_PLANNING`; event не является canonical transaction и не подтверждает account balance. Progress и required monthly contribution вычисляются детерминированно в exact integer minor units; recommendation имеет `model_kind=DETERMINISTIC_RULE`, `hidden_forecast=false`, `financial_truth=false`. Budget semantics не переопределяются, PROJ/ML не используются, canonical/budget mutation=false, `financial_write=false`, storage/network/runtime authority=false; public evidence synthetic-only; `FREE_ONLY` mandatory.

## R4 / Yandex Cloud shadow platform

- `YC-040` — **DONE**, Issue #141 Main Verification PASS, merge `924a44f4cb01e6add6c7fd9a0b166d7a7743b96a`.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS, merge `455c7fdaaaee118369294d96183631d7322e5ea2`.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`; writer authority отсутствует.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`; writer authority отсутствует.

Google остаётся authoritative; cloud blockers не создают billing-backed resources и не меняют canonical write ownership.

## R7 / Semantic Analytics

`ANL-070`, `SCOPE-070`, `ANL-071`, `ANL-074` — DONE/Main Verification PASS. ANL-072/BENCH-070/ANL-073 остаются P2 backlog; `PERF-070`/`TEST-070` пока dependency-blocked.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`; GitHub Actions and AI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is public-safe AI operating contract. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` enforce one-writer continuation. Read-only multi-AI reviewers have `writer_authority=false`; machine gates and Main Verification remain authoritative.

Required AI gates (`AI playbooks`, `AI regression eval`) и model/cost routing остаются local deterministic; separately billed OpenAI API не требуется для required checks.

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

GOAL-030 остаётся открытым до `Goals and wish-list` + BUD/PROJ/TREND/FIN/MIG/analytics/profile/AI/LANG-RU/privacy/FREE_ONLY/full layered/UI/PWA PASS, immutable candidate, trusted exact-head deploy/runtime health, autonomous merge и Main Verification.

## Current runtime truth

Private primary store/runtime: Google Sheets + Apps Script; family UI: private `MYSELF` Apps Script Web Dashboard. Public GitHub evidence is independently generated synthetic only. GOAL-030 — pure planning-domain layer и не меняет runtime financial state/backend storage. `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.3 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
