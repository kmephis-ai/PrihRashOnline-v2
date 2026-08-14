# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` v2.4 + временное approved amendment `docs/ROADMAP_LOCAL_FIRST_RECOVERY.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

## Текущий critical path — Local-first Recovery

Решение владельца от 2026-08-14: request-per-view модель `Apps Script -> Google Sheets -> server analytics -> HtmlService iframe` больше не развивается как стратегический пользовательский read path. Целевая архитектура: **Local-first SPA + IndexedDB + Web Worker + background revision/delta synchronization**. Google Sheets остаётся canonical source на переходном этапе; YDB — будущий remote read backend через shadow/dual-read/compare/canary/strangler migration.

- `ARCH-LF-001` — **IN_PROGRESS**, Issue #245, branch `agent/ARCH-LF-001-local-first-rebaseline`; единственный current writer. Цель — зафиксировать architecture contract, Local Read Model, IndexedDB/Worker/sync boundaries, SLO и исполняемый LF Roadmap.

До `MASTER-LF-PRODUCT` новый Dashboard feature expansion frozen, кроме security/privacy/data-integrity incidents и самой Local-first recovery chain. Warm route/filter/chart после синхронизации должен работать локально без обязательного network request и без Google Sheets read.

`FIN-REC-001` Issue #224 и PR #243 закрыты без merge как superseded request-per-view implementation. Их FIN-TRUTH/filter/revision/zero-write решения остаются engineering reference. `VIZ-REC-001` #226 сохраняет прежний runtime-integrated reference; R9/R10 остаются frozen.

## R0 — завершён

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. Исполнимая AI-инженерная цепочка сохраняется: `AIENG-001 = DONE` -> `AIENG-002 = DONE` -> `AIENG-003 = DONE`; `AIENG-004`, `AIENG-005`, `AIENG-006` также DONE/Main Verification PASS. `DR-001`, `OBS-001`, `FINOPS-001` — DONE.

`LANG-RU` обязателен. Real or real-derived household finance data остаётся private; public repo содержит только public-safe contracts, independently generated synthetic finance fixtures и privacy-safe machine evidence. `FREE_ONLY` остаётся executable invariant.

## R1 / Canonical Financial Platform — завершена

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; owner-private reconciliation ранее PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS.
- `TEST-010`, `OBS-010`, `PERF-010`, `PERF-011`, `PERF-012`, `PERF-013`, `PERF-014`, `DOC-010` — **DONE** / Main Verification PASS.

`MASTER-G3 / Canonical platform` — **complete**; historical pre-close state: **open**. FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`. Repository authority = `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Post-R1 lifecycle handoff исторически начинается с `DESIGN-020`; этот anchor сохраняется. `DOC-010` не является current writer.

## R2/R2R — Product Recovery rebaseline

R2 engineering contracts `DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020`, `INC-020`, `CF-020`, `BUD-020`, `OBL-020`, `DQ-020`, `PWA-020`, `PROF-020`, `UI-MIG-020` сохраняются как reusable engineering work, но product credit даётся только exact-SHA Product Ready evidence.

Forensic/Product Recovery baseline `R2R` и `MASTER-GUX` остаются причиной freeze feature breadth. `GOV-REC-001`, `PERF-REC-001`, `UI-REC-001`, `GOV-REC-002`, `DATA-REC-001` завершили свои доказанные stages. `FIN-REC-001` superseded новым architecture direction. Старые PLAN/E2E/STUDIO recovery scopes будут re-depended или перенесены в LF3/LF4 после architecture rebaseline.

Request-per-view технические оптимизации PERF-010/011/012/013/070 не выбрасываются: они остаются полезными для bootstrap/sync, reconciliation и parity, но больше не определяют warm interaction topology.

## Local-first target truth

После verified bootstrap критический путь обычного действия:

```text
SPA state
-> IndexedDB / in-memory Local Read Model
-> Web Worker analytics
-> ECharts / UI
```

Google Sheets + Apps Script работают как canonical source и trusted background sync/reconciliation adapter. Local Read Model read-only, exact-revision bound и не получает canonical write authority. Partial generation не должна становиться visible current state; delta с недоказанной base revision должен переходить в full rebuild.

Target Product SLO — будущие acceptance targets, не текущие измерения: warm route p95 <=100 ms, filter/KPI <=200 ms, normal chart desktop <=300 ms, representative mobile <=500 ms, Back/Forward <=100 ms, cached first meaningful paint <=800 ms. Server technical health latency не считается этим Product SLA.

## R3 / R7 / R8 — reusable engineering foundation

`TREND-030`, `PROJ-030`, `GOAL-030`, `BAL-030`, `NW-030`, `SUB-030` — DONE_ENGINEERING/Main Verification PASS. Semantic analytics `ANL-070`, `SCOPE-070`, `ANL-071`, `ANL-072`, `BENCH-070`, `ANL-073`, `ANL-074`, `PERF-070`, `TEST-070`, `VIZ-070` — DONE_ENGINEERING/Main Verification PASS. Studio/dashboard configuration contracts R8 также остаются reusable, но не автоматически считаются working private product.

## R4 / YDB future backend

`YC-040` — DONE/Main Verification PASS и остаётся PoC/cost-envelope foundation. `YC-041`/`YC-042` не получают writer authority автоматически. На этапе ARCH-LF Google authoritative store не меняется и live YDB resource не создаётся.

Future ladder после Local-first Product Ready:

`GOOGLE_AUTHORITATIVE_LOCAL_FIRST -> YDB_SHADOW_REPLICA -> DUAL_READ_COMPARE -> YDB_READ_CANARY -> YDB_READ_AUTHORITY -> отдельный future owner-authorized write cutover`.

Big-bang YDB cutover запрещён. `paidOverageAllowed=false`; unknown billing state остаётся BLOCKED.

## MIG-010 historical safety boundary

MIG-010 owner-private evidence ранее подтвердил `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` был exact-bound и **не может повторно использоваться**. Current financial write authority = false; любое будущее irreversible изменение требует нового exact-bound owner authorization и fresh recovery evidence.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V2` enforce one-writer and separate engineering/product stages. Read-only multi-AI review остаётся supplementary evidence; machine gates и Main Verification выше textual review.

Временный Local-first Roadmap amendment не отменяет `docs/ROADMAP.md` v2.4: он приоритетно задаёт LF0..LF4 recovery execution до консолидации в следующую каноническую Roadmap version.

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

Engineering item закрывается как `DONE_ENGINEERING`. User-facing item закрывается только при `product_stage=PRODUCT_READY` и exact-candidate `product-ready-e2e=success`; synthetic/file-local evidence недостаточно.

## Source precedence

1. security/privacy/cost/irreversible-action boundaries;
2. `docs/ROADMAP.md` v2.4 + approved `docs/ROADMAP_LOCAL_FIRST_RECOVERY.md` + live GitHub Issues;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
