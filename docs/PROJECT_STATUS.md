# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

Forensic rebaseline 2026-08-11 отделяет formal engineering progress от продукта: audited legacy baseline = 75/107 (70,1%), после материализации девяти Recovery items = 75/116 (64,7%), independent Product Readiness ≈25%. Issue-count completion не является product metric. Это governance/integration incident, а не доказанный инцидент повреждения financial data.

## R0 — critical path завершён

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — **complete**. `DOC-001`, `DOC-002`, `AIENG-001`, `AIENG-002`, `AIENG-003`, `AIENG-004`, `AIENG-005`, `AIENG-006`, `DR-001`, `OBS-001`, `FINOPS-001` — DONE/Main Verification PASS.

- `AIENG-004` — **DONE**, Issue #157 Main Verification PASS, merge `280dea294b086fae3cedf56df7899c9938b42b88`.
- `AIENG-005` — **DONE**, Issue #159 Main Verification PASS, merge `5fe90929f5f266fcd92bbc9745f78107083f6b5c`.
- `AIENG-006` — **DONE**, Issue #146 Main Verification PASS, merge `0f7722c48dfc05b12efd861ecaa5d0b1f408c98a`.

`LANG-RU` обязателен. PR/Migration review остаются READ_ONLY; machine gates и Main Verification выше human summary.

## R1 / Canonical Financial Platform — завершена

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED` reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` — **DONE**.

`MASTER-G3 / Canonical platform` — **complete**; historical pre-close state: open. FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`. Repository authority = `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Post-R1 handoff historically начинается с `DESIGN-020`; этот lifecycle anchor сохраняется после завершения R2–R8.

## R2 / Family Finance Center — engineering complete, product partial

`DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` — historical DONE/Main Verification PASS в объявленном engineering scope.

Canonical private Web App default route = R2 Financial Home; private binding доказан только для Home. Семь Daily routes fail-closed/unbound, поэтому R2 Product Ready = false до `MASTER-GUX`. Legacy Dashboard остаётся bounded rollback route. Web App остаётся `MYSELF`; `NOT_PROVEN_CURRENT_HOST` PWA boundary и `FREE_ONLY` сохраняются.

## R2R / Product Recovery — текущий critical path

- `GOV-REC-001` — **DONE**, Issue #219 Main Verification PASS, merge `5c1fe264bc35d7aaf755e611536dabbf31e3f6c0`.
- `UI-REC-001` — **BLOCKED**, Issue #221; owner-authenticated UAT deployed candidate `ba34d244…` доказал initial Home load >60s и `PRODUCT_READY_E2E = FAIL`. Engineering correction `7a322d59…` зелёная, PR #229 остаётся draft и не имеет writer authority до performance recovery.
- `PERF-REC-001` — **IN_PROGRESS**, Issue #222, branch `agent/PERF-REC-001-live-snapshot-baseline`; единственный current writer. Цель: live PERF-011/012 integration, revision-aware Home path и trusted cold/warm baseline без financial payload.
- `ANL-090` Issue #217 — BLOCKED `PAUSED_REBASELINE`; PR #218 draft, код сохранён без writer authority.
- Downstream order: PERF -> UI revalidation -> DATA -> FIN/PLAN -> VIZ -> E2E -> `MASTER-GUX` -> STUDIO -> `MASTER-GSTUDIO`.
- R9/R10 feature expansion frozen.

Apps Script version capacity после owner UAT: observed 191/200. Intermediate recovery deployments запрещены; draft PR используется до CODE_COMPLETE, чтобы не расходовать version slots без доказанной необходимости.

## R3 / Planning, Wealth, Decision Intelligence

`TREND-030`, `PROJ-030`, `GOAL-030`, `BAL-030`, `NW-030`, `SUB-030` — DONE_ENGINEERING/Main Verification PASS; product integration не доказана. SUB-030 precision-first и не имеет automatic canonical mutation/financial truth authority.

## R4 / Yandex Cloud shadow platform

- `YC-040` — **DONE**, Issue #141 Main Verification PASS.
- `AUTH-040` — **DONE**, Issue #142 Main Verification PASS.
- `YC-041` — **BLOCKED**, Issue #148, `OWNER_CLOUD_BOOTSTRAP_REQUIRED`; `writer_authority=false`.
- `YC-042` — **BLOCKED**, Issue #149, `OWNER_YDB_TARGET_REQUIRED`; `writer_authority=false`.

Google остаётся authoritative; cloud blockers не создают billing-backed resources и не меняют canonical write ownership.

## R7 / Semantic Analytics — engineering complete

`ANL-070`, `SCOPE-070`, `ANL-071`, `ANL-072`, `BENCH-070`, `ANL-073`, `ANL-074`, `PERF-070`, `TEST-070`, `VIZ-070` — DONE_ENGINEERING/Main Verification PASS. `MASTER-G7-ENGINEERING` — complete; private runtime/UI integration не доказана.

- `ANL-074` — Issue #155 Main Verification PASS, merge `b461bfea099a6b35b8f156975f405ed4d4b58af1`.
- `VIZ-070` — Issue #192 Main Verification PASS, merge `13091bb5ba731673bae5357ae7b22b64475592c3`.

VIZ-070 authority остаётся `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`; BAR/LINE/DONUT и renderer/query boundaries остаются canonical.

## R8 / Analytics Studio — engineering complete, product unbound

`STUDIO-080`, `PRIV-080`, `DASH-080`, `DASH-081`, `DASH-082`, `DASH-083`, `DASH-084`, `DASH-085`, `DASH-086` — DONE_ENGINEERING/Main Verification PASS. `MASTER-G8-ENGINEERING` — complete; current Studio/composer остаётся configuration/session-only без private analytics execution.

- `DASH-084` — Issue #206 DONE/Main Verification PASS, candidate `3626aab53c2a3b71ffff5dc0be579c061517a893`, merge `06e96ad4cb4d03f9447467224ec66dddea470238`.
- `DASH-085` — canonical Issue #208 DONE/Main Verification PASS; recovery merge `7aeb044ffed8378d0a4aa3894d60b10caf309f2b`. Duplicate Issue #209 / PR #210 closed without merge, `writer_authority=false`.
- `DASH-086` — Issue #213 DONE/Main Verification PASS, candidate `e3b78983a22316ae533e94e84135fe5bc4426c58`, merge `a7a73889a4f5deff15e086b5469f00f240cab6e0`.

R8 final guarantees: responsive composer, semantic bindings, cross-filter, drill-through, private saved views, wide visual customization и safe portable dashboard configuration работают без переноса FIN-TRUTH/query/write authority в dashboard layer. DASH-086 import остаётся `DRY_RUN_ONLY`; persistence выполняется только отдельным explicit DASH-084 lifecycle call.

## R9 / Advanced Financial Analytics & Visual Intelligence — frozen

- `VIZ-090` — DONE_ENGINEERING/Main Verification PASS: 18-family semantic planner/validator реализован, но browser renderer/private query consumer отсутствует.
- `ANL-090` — BLOCKED `PAUSED_REBASELINE`, Issue #217; PR #218 draft.
- `MASTER-G9-ENGINEERING` не может считаться production gate. Дальнейший execution разрешается только после `MASTER-GSTUDIO` и отдельного owner decision.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence remains `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. **Current write authority = false**. Owner-verified private full-history reconciliation remains completed correctness proof.

Execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion until separate post-write reconciliation PASS.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable. GitHub Actions cannot create it; AI/CI cannot reuse it for later mutations. Any future irreversible financial write requires fresh exact-bound owner authorization.

## Executable AI engineering baseline

Root `AGENTS.md` is public-safe AI operating contract. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V2` enforce one-writer and dual engineering/product stages. Read-only multi-AI reviewers have `writer_authority=false`; machine gates and Main Verification remain authoritative.

## Current delivery chain

```text
active Roadmap Issue
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health
-> Product Ready E2E for work_class=user_facing
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE
```

Engineering item закрывается как `DONE_ENGINEERING`. User-facing item закрывается только при `product_stage=PRODUCT_READY` и exact-candidate `product-ready-e2e=success`; synthetic/file-local/contracts/render smoke недостаточны.

## Current runtime truth

Private primary financial store/runtime = Google Sheets + Apps Script. Canonical default Web App route = R2 Financial Home; private binding доказан только для Home. Owner UAT доказал текущий synchronous full-history Home path неприемлемым по latency; PERF-REC-001 является P0 blocker. R8 UserProperties/portable boundaries configuration-only. VIZ-090 pure semantic planner не читает financial storage и не выполняет ECharts renderer. Public GitHub evidence synthetic/configuration-only; private UI remains `MYSELF`; `FREE_ONLY` mandatory.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.4 + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
