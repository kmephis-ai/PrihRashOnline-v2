# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` v2.5 + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. `docs/ROADMAP_LOCAL_FIRST_RECOVERY.md` сохранён как historical/consolidated reference. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

Root `AGENTS.md` is the public-safe repository AI operating contract. Он задаёт обязательные правила автономности, one-writer, privacy, FREE_ONLY, FIN-TRUTH и fail-closed delivery; этот human summary не расширяет authority.

## Текущий critical path — Post-GSTUDIO R9

Решение владельца от 2026-08-14: request-per-view модель `Apps Script -> Google Sheets -> server analytics -> HtmlService iframe` больше не развивается как стратегический пользовательский read path. Целевая архитектура: **Local-first SPA + IndexedDB + Web Worker + background revision/delta synchronization**. Google Sheets остаётся canonical source на переходном этапе; YDB — будущий remote read backend через shadow/dual-read/compare/canary/strangler migration.

Завершённый Local-first/Product Recovery baseline:

- `ARCH-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #245, PR #248.
- `SPA-LF-001` — **DONE / Main Verification PASS**, Issue #249, PR #250; owner UAT PASS, warm route p95 `29 ms`, сеть `0`.
- `STORE-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #251, PR #252.
- `WORKER-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #253, PR #254.
- `SYNC-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #255, PR #256.
- `DELTA-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #257, PR #258.
- `FIN-LF-001` — **DONE / Main Verification PASS**, Issue #259, PR #260; exact-candidate Owner Product UAT PASS.
- `DATA-LF-001` — **DONE / Main Verification PASS**, Issue #263, PR #264; exact-candidate Owner Product UAT PASS.
- `PERF-LF-001` — **DONE / Main Verification PASS**, Issue #265, PR #266; retained warm Product SLO and zero mandatory network / Google Sheets reads proven.
- `E2E-LF-001` — **DONE / Main Verification PASS**, Issue #273, PR #274; `MASTER-LF-PRODUCT` Product Ready E2E desktop+mobile PASS.
- `GOV-LF-001` — **DONE / Main Verification PASS**, Issue #275, PR #276.
- `PACK-LF-002` — **DONE_ENGINEERING / Main Verification PASS**, Issue #278, PR #279.
- `PLAN-REC-001` — **DONE / Main Verification PASS**, Issue #225, PR #277, merge `d69f13f4842726ef893005fa1ebfbee1dc9e57bd`; Owner Product UAT v259 + Product Ready E2E PASS.
- `PACK-VIZ-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #280, PR #281, merge `5306d0e9593d0e5398b69c1fb03bf31bd50a8eda`.
- `PACK-VIZ-LF-002` — **DONE_ENGINEERING / Main Verification PASS**, Issue #283, PR #284, merge `00659d0e423e4baf222b056e732b576887200891`.
- `VIZ-REC-001` — **DONE / Main Verification PASS**, Issue #226, PR #285, merge `011bb5e5a42f3ccab4d1e82f323bd304b2c89783`; fresh Owner Product UAT + Product Ready evidence PASS.
- `STUDIO-REC-001` — **DONE / Main Verification PASS**, Issue #228, PR #286, candidate `92c4139e552428a1726640487834952d523dab64`, merge `e62b3283927ffe0d564ec7f10d2671760a03ceec`; Owner Product UAT v263, Product Ready E2E и `MASTER-GSTUDIO / STUDIO-READY` PASS.

Текущая единственная writer-транзакция:

- `ADWF-ADOPT-001` — **IN_PROGRESS**, **current writer / текущий writer**, Issue #287, PR #289, branch `agent/ADWF-ADOPT-001-real-adoption-e3bd9fb`, trust anchor `main@19dc9f653131715233da91a28598e012af64f36f`. Это bounded engineering/integration transaction: установка ADWF consumer-managed surfaces и sealed consumer bindings без product/runtime/data/FIN-TRUTH write authority.
- `ANL-090` — **DONE_ENGINEERING / Main Verification PASS**, Issue #217, PR #288, canonical result входит в `main@19dc9f653131715233da91a28598e012af64f36f`; writer authority завершена и не переносится на текущую транзакцию.

Текущий bounded scope `ADWF-ADOPT-001`: подключить PrihRash к ADWF `e3bd9fb33f699ae227521f7ed5866c8f11589ed4` в режиме `CONSUMER_NATIVE`; сохранить `docs/ROADMAP.md` + live GitHub Issues как product/work SSOT; делегировать PR/main/runtime evidence нативным `validate` / `verify` / `probe`; разрешить в PrihRash только read-only `consumer-observer`, без self-host mutation authority. `FREE_ONLY`, FIN-TRUTH и текущая business/runtime semantics не изменяются.

Текущая последовательность: `ADWF-ADOPT-001 PR #289 -> native PR Validation/validate + ADWF PR consumer delegation -> existing protected/autonomous merge contract -> Main Verification/verify + ADWF Main delegation -> consumer-observer + fresh-session provider readback -> framework upgrade dry-run`. До завершения этой цепочки PrihRash не объявляется ADWF-managed.

`E2E-REC-001` superseded завершённым `E2E-LF-001`; `YC-041`/`YC-042` остаются owner/cloud BLOCKED. Следующие product/R9 writer-транзакции не стартуют параллельно с текущим integration writer.

## R0 — завершён

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete; R0 platform baseline завершён. Исполнимая AI-инженерная цепочка сохраняется: `AIENG-001 = DONE` -> `AIENG-002 = DONE` -> `AIENG-003 = DONE`; `AIENG-004`, `AIENG-005`, `AIENG-006` также DONE/Main Verification PASS. `DR-001`, `OBS-001`, `FINOPS-001` — DONE.

`LANG-RU` обязателен. Real or real-derived household finance data остаётся private; public repo содержит только public-safe contracts, independently generated synthetic finance fixtures и privacy-safe machine evidence. `FREE_ONLY` остаётся executable invariant.

## R1 / Canonical Financial Platform — завершена

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Main Verification PASS, Issue #89.
- `ARCH-011` — **DONE**, Main Verification PASS, Issue #91.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private stage `OWNER_VERIFIED`, owner-private full-history reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010`, `PERF-011`, `PERF-012`, `PERF-013`, `PERF-014`, `DOC-010` — **DONE** / Main Verification PASS.

Public-safe MIG-010 evidence сохраняет machine result `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`: post-write reconciliation PASS, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed duplicate-preservation identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. **Current write authority = false**. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` был exact-bound/non-reusable. GitHub Actions cannot create it; AI/CI cannot reuse it. Any future irreversible financial write requires fresh exact-bound owner authorization.

`MASTER-G3 / Canonical platform` — complete; historical pre-close state: **open**. FIN authority = `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1`. DATA authority = `PRH_CANONICAL_TRANSACTION_V1`. Repository authority = `PRH_TRANSACTION_REPOSITORY_V1`; generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Post-R1 lifecycle handoff historically начинается с `DESIGN-020`; этот anchor сохраняется и при Local-first rebaseline.

## Local-first target truth

После verified bootstrap обычный warm interaction path:

```text
SPA state
-> IndexedDB / in-memory Local Read Model
-> Web Worker analytics
-> ECharts / UI
```

Warm route/filter/chart обязан работать без mandatory network request и без Google Sheets read. Background sync не блокирует уже готовую verified local revision. Local Read Model read-only, exact-revision bound и не получает canonical write authority. Partial generation не становится visible current state; delta с недоказанной base revision переходит в full rebuild.

`PRH_LOCAL_FINANCE_RUNTIME_V1@1.0.0` и `PRH_LOCAL_PLANNING_RUNTIME_V1@1.0.0` используют canonical Worker/evaluateAnalytics и exact revision binding. UI не получает отдельную financial-formula authority. Planning snapshot имеет отдельный `planning_revision`, но принимается только при exact equality с active finance canonical revision; Liquidity требует явных balance observations, а Cash Flow не является balance proxy.

`PRH_LOCAL_FIRST_PERFORMANCE_CONTRACT_V1@1.0.0`: warm route p95 <=100 ms; filter/KPI <=200 ms; ordinary chart desktop <=300 ms; representative mobile <=500 ms; Back/Forward <=100 ms; cached first meaningful paint <=800 ms. Cold bootstrap/background sync не подменяют warm Product SLO.

## R2/R2R — Product Recovery завершён

R2 engineering contracts остаются reusable, но product credit даётся только exact-SHA Product Ready evidence. Historical request-per-view optimizations могут использоваться для bootstrap/sync/reconciliation/parity, но не определяют warm interaction topology.

`VIZ-REC-001` завершён на Local-first canonical read model / approved display-only ChartSpec, pinned local Apache ECharts без external CDN/runtime fetch и с semantic fallback. Renderer не получает FIN/query/write authority.

`STUDIO-REC-001` завершил working bound query -> widget -> save/reload -> drill chain поверх canonical Local-first runtime. Save/reload хранит configuration + query identity без financial values/private IDs; private drill IDs ephemeral; UNBOUND widgets не получили product authority.

## R3 / R7 / R8 / R9

`TREND-030`, `PROJ-030`, `GOAL-030`, `BAL-030`, `NW-030`, `SUB-030` — DONE_ENGINEERING/Main Verification PASS. Semantic analytics `ANL-070`, `SCOPE-070`, `ANL-071`, `ANL-072`, `BENCH-070`, `ANL-073`, `ANL-074`, `PERF-070`, `TEST-070`, `VIZ-070` — DONE_ENGINEERING/Main Verification PASS. Studio/dashboard configuration contracts R8 остаются reusable.

`MASTER-GSTUDIO` PASS. `ANL-090` завершён как **DONE_ENGINEERING / Main Verification PASS** через PR #288 и больше не является writer. `ANL-091`, `XRAY-090`, `PERF-090` и другие R9 items не получают writer authority, пока текущая интеграционная транзакция `ADWF-ADOPT-001` не завершена.

## R4 / YDB future backend

`YC-040` — DONE/Main Verification PASS и остаётся PoC/cost-envelope foundation. `YC-041`/`YC-042` не получают writer authority автоматически. Future ladder: `GOOGLE_AUTHORITATIVE_LOCAL_FIRST -> YDB_SHADOW_REPLICA -> DUAL_READ_COMPARE -> YDB_READ_CANARY -> YDB_READ_AUTHORITY -> отдельный future owner-authorized write cutover`. Big-bang YDB cutover запрещён; `paidOverageAllowed=false`; unknown billing state остаётся BLOCKED.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract. `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V2` enforce one-writer and separate engineering/product stages. Read-only multi-AI review остаётся supplementary evidence; machine gates и Main Verification выше textual review.

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

## Execution invariant

Одна конфликтующая writer-транзакция одновременно. Read-only audits допустимы параллельно. `DONE` для user-facing work запрещён без fresh exact-SHA machine/runtime evidence и требуемого Owner Product UAT. Engineering-only work не может фабриковать Product Ready. Security/privacy/cost/FIN-TRUTH gates остаются fail-closed.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. `docs/ROADMAP.md` v2.5 + live GitHub Issues; Local-first recovery amendment — historical/consolidated reference;
3. exact-SHA code/tests/workflows/machine evidence;
4. versioned contracts;
5. architecture/ADR/operations docs;
6. README/user docs.
