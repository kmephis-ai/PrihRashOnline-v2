# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` v2.5 + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. `docs/ROADMAP_LOCAL_FIRST_RECOVERY.md` сохранён как historical/consolidated reference. Human documentation не может отменять красный machine gate.

Machine release model: `EXACT_SHA_AUTONOMOUS`; trusted delivery authority закреплена `CI-003`.

Root `AGENTS.md` is the public-safe repository AI operating contract. Он задаёт обязательные правила автономности, one-writer, privacy, FREE_ONLY, FIN-TRUTH и fail-closed delivery; этот human summary не расширяет authority.

## Текущий critical path — Post-LF Roadmap v2.5

Решение владельца от 2026-08-14: request-per-view модель `Apps Script -> Google Sheets -> server analytics -> HtmlService iframe` больше не развивается как стратегический пользовательский read path. Целевая архитектура: **Local-first SPA + IndexedDB + Web Worker + background revision/delta synchronization**. Google Sheets остаётся canonical source на переходном этапе; YDB — будущий remote read backend через shadow/dual-read/compare/canary/strangler migration.

Завершённый Local-first baseline:

- `ARCH-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #245, PR #248.
- `SPA-LF-001` — **DONE / Main Verification PASS**, Issue #249, PR #250; owner UAT PASS, warm route p95 `29 ms`, сеть `0`.
- `STORE-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #251, PR #252.
- `WORKER-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #253, PR #254.
- `SYNC-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #255, PR #256.
- `DELTA-LF-001` — **DONE_ENGINEERING / Main Verification PASS**, Issue #257, PR #258.
- `FIN-LF-001` — **DONE / Main Verification PASS**, Issue #259, PR #260; exact-candidate Owner Product UAT PASS.
- `DATA-LF-001` — **DONE / Main Verification PASS**, Issue #263, PR #264; exact-candidate Owner Product UAT PASS.
- `PERF-LF-001` — **DONE / Main Verification PASS**, Issue #265, PR #266; retained warm Product SLO and zero mandatory network / Google Sheets reads proven.
- `E2E-LF-001` — **DONE / Main Verification PASS**, Issue #273, PR #274, merge `12f764edc34aad32693fc7589ff53ded53740d5d`; `MASTER-LF-PRODUCT` Product Ready E2E desktop+mobile PASS.
- `GOV-LF-001` — **DONE / Main Verification PASS**, Issue #275, PR #276, merge `d57d0b3554737b9a57bde5d55f13c13e88cbcbc4`.
- `PACK-LF-002` — **DONE_ENGINEERING / Main Verification PASS**, Issue #278, PR #279; trusted planning browser-module bootstrap завершён без self-attestation.
- `PLAN-REC-001` — **DONE / Main Verification PASS**, Issue #225, PR #277, candidate `e73e72a4429c079d9dd44ab406eb89ea52ad7dba`, merge `d69f13f4842726ef893005fa1ebfbee1dc9e57bd`; Owner Product UAT v259 + Product Ready E2E PASS. Budget/Obligations/Liquidity работают как exact-revision-bound Local-first read-only planning flows без Cash Flow-as-balance proxy и без financial writes.

Текущая единственная writer-транзакция:

- `PACK-VIZ-LF-001` — **IN_PROGRESS**, **current writer / текущий writer**, Issue #280, PR #281, branch `agent/PACK-VIZ-LF-001-echarts-packager-bootstrap`; engineering-only trust bootstrap переносит trusted ECharts vendor target с legacy `FinancialHomeWebApp.html` на canonical `LocalFirstSpaWebApp.html`. Root `echarts-vendor.json` в этом item не активируется; Product UI/FIN semantics не меняются; Owner Product UAT и `product-ready-e2e` для bootstrap — NOT_APPLICABLE.

Следующая последовательность: `PACK-VIZ-LF-001 Main Verification -> VIZ-REC-001 READY -> fresh post-LF exact candidate -> desktop + physical mobile Owner Product UAT -> Product Ready -> Main Verification`. Historical PR #238 / candidate `5bad584e6b09d6af3fc9bda18322f5682e1806fa` остаётся только historical engineering evidence и не имеет post-LF merge/runtime authority.

`VIZ-REC-001` остаётся BLOCKED до Main Verification #280/#281. `E2E-REC-001` superseded завершённым `E2E-LF-001`; `STUDIO-REC-001` BACKLOG. `YC-041`/`YC-042` остаются owner/cloud BLOCKED.

## R0 — завершён

`MASTER-G0`, `MASTER-G1`, `MASTER-G2` — complete. Исполнимая AI-инженерная цепочка сохраняется: `AIENG-001 = DONE` -> `AIENG-002 = DONE` -> `AIENG-003 = DONE`; `AIENG-004`, `AIENG-005`, `AIENG-006` также DONE/Main Verification PASS. `DR-001`, `OBS-001`, `FINOPS-001` — DONE.

`LANG-RU` обязателен. Real or real-derived household finance data остаётся private; public repo содержит только public-safe contracts, independently generated synthetic finance fixtures и privacy-safe machine evidence. `FREE_ONLY` остаётся executable invariant.

## R1 / Canonical Financial Platform — завершена

- `FIN-010` — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` — **DONE**, Main Verification PASS, Issue #89.
- `ARCH-011` — **DONE**, Main Verification PASS, Issue #91.
- `MIG-010` — **DONE**, Issue #96 Main Verification PASS; private stage `OWNER_VERIFIED`, owner-private full-history reconciliation PASS.
- `ANL-010` — **DONE**, Issue #98 Main Verification PASS; `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `financial_write=false`.
- `TEST-010`, `OBS-010`, `PERF-010`, `PERF-011`, `PERF-012`, `PERF-013`, `PERF-014`, `DOC-010` — **DONE** / Main Verification PASS.

Public-safe MIG-010 evidence сохраняет machine result `MIG010_OWNER_POST_RECONCILIATION_V1`: post-write reconciliation завершена, `unexplainedMismatch=0`. Отдельная irreversible boundary остаётся явной: только Owner может создать `IRREVERSIBLE_ACTION_AUTHORIZED`; occurrence identity capability — `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Private values и owner resolution payload здесь не публикуются.

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

Warm route/filter/chart обязан работать без mandatory network request и без Google Sheets read. Background sync не блокирует уже готовую verified local revision. Local Read Model read-only, exact-revision bound и не получает canonical write authority. Partial generation не должна становиться visible current state; delta с недоказанной base revision должен переходить в full rebuild.

`PRH_LOCAL_FINANCE_RUNTIME_V1@1.0.0` и `PRH_LOCAL_PLANNING_RUNTIME_V1@1.0.0` используют canonical Worker/evaluateAnalytics и exact revision binding. UI не получает отдельную financial-formula authority. Planning snapshot имеет отдельный `planning_revision`, но принимается только при exact equality с active finance canonical revision; Liquidity требует явных balance observations, а Cash Flow не является balance proxy.

`PRH_LOCAL_FIRST_PERFORMANCE_CONTRACT_V1@1.0.0`: warm route p95 <=100 ms; filter/KPI <=200 ms; ordinary chart desktop <=300 ms; representative mobile <=500 ms; Back/Forward <=100 ms; cached first meaningful paint <=800 ms. Cold bootstrap/background sync не подменяют warm Product SLO.

## R2/R2R — Product Recovery rebaseline

R2 engineering contracts остаются reusable, но product credit даётся только exact-SHA Product Ready evidence. Historical request-per-view optimizations могут использоваться для bootstrap/sync/reconciliation/parity, но не определяют warm interaction topology.

`VIZ-REC-001` обязан использовать Local-first canonical read model / approved ChartSpec, pinned local Apache ECharts без external CDN/runtime fetch, semantic fallback и новый exact candidate. Renderer не получает FIN/query/write authority.

## R3 / R7 / R8 — reusable engineering foundation

`TREND-030`, `PROJ-030`, `GOAL-030`, `BAL-030`, `NW-030`, `SUB-030` — DONE_ENGINEERING/Main Verification PASS. Semantic analytics и Studio/dashboard contracts остаются reusable engineering foundation, но не автоматически считаются working private product без current Product Ready evidence.

## R4 / YDB future backend

`YC-040` — DONE/Main Verification PASS и остаётся PoC/cost-envelope foundation. `YC-041`/`YC-042` не получают writer authority автоматически. Future ladder: `GOOGLE_AUTHORITATIVE_LOCAL_FIRST -> YDB_SHADOW_REPLICA -> DUAL_READ_COMPARE -> YDB_READ_CANARY -> YDB_READ_AUTHORITY -> отдельный future owner-authorized write cutover`. Big-bang YDB cutover запрещён; `paidOverageAllowed=false`; unknown billing state остаётся BLOCKED.

## Execution invariant

Одна конфликтующая writer-транзакция одновременно. Read-only audits допустимы параллельно. `DONE` для user-facing work запрещён без fresh exact-SHA machine/runtime evidence и требуемого Owner Product UAT. Engineering-only bootstrap не может фабриковать Product Ready. Security/privacy/cost/FIN-TRUTH gates остаются fail-closed.
